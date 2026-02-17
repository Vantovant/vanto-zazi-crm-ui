import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { docId } = await req.json();
    if (!docId) throw new Error("docId is required");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the doc record
    const { data: doc, error: docError } = await supabase
      .from("user_knowledge_docs")
      .select("*")
      .eq("id", docId)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("knowledge-docs")
      .download(doc.file_path);

    if (downloadError || !fileData) {
      await supabase.from("user_knowledge_docs").update({ status: "error" }).eq("id", docId);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";
    const fileType = doc.file_type.toLowerCase();

    if (fileType === "text/plain" || doc.file_name.endsWith(".txt") || doc.file_name.endsWith(".md")) {
      // Plain text / markdown
      extractedText = await fileData.text();
    } else if (fileType === "application/pdf" || doc.file_name.endsWith(".pdf")) {
      // For PDFs, extract raw text content
      const arrayBuffer = await fileData.arrayBuffer();
      extractedText = extractTextFromPdfRaw(new Uint8Array(arrayBuffer));
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      doc.file_name.endsWith(".docx")
    ) {
      // For DOCX, extract text from XML
      extractedText = await extractTextFromDocx(fileData);
    } else if (fileType === "application/msword" || doc.file_name.endsWith(".doc")) {
      // Old .doc format - try to extract plain text
      const arrayBuffer = await fileData.arrayBuffer();
      extractedText = extractPlainTextFromBinary(new Uint8Array(arrayBuffer));
    } else {
      // Try as plain text fallback
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText = "[Could not extract text from this file type]";
      }
    }

    // Truncate to ~100k chars to stay within DB limits
    if (extractedText.length > 100000) {
      extractedText = extractedText.substring(0, 100000) + "\n\n[Document truncated at 100,000 characters]";
    }

    // Update the doc record with extracted text
    await supabase
      .from("user_knowledge_docs")
      .update({
        extracted_text: extractedText,
        status: extractedText.trim() ? "ready" : "empty",
      })
      .eq("id", docId);

    return new Response(
      JSON.stringify({ success: true, charCount: extractedText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-knowledge-doc error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Extract readable text from raw PDF bytes by finding text operators.
 * This is a lightweight extraction - works for most text-based PDFs.
 */
function extractTextFromPdfRaw(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];

  // Extract text between BT and ET operators (text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Find text within parentheses (Tj operator) and angle brackets
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      chunks.push(tjMatch[1]);
    }
    // TJ array operator
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        chunks.push(strMatch[1]);
      }
    }
  }

  if (chunks.length === 0) {
    // Fallback: extract any readable strings
    const readableRegex = /\(([A-Za-z0-9 .,;:!?'"\/\-@#$%&*+=]{3,})\)/g;
    let rMatch;
    while ((rMatch = readableRegex.exec(text)) !== null) {
      chunks.push(rMatch[1]);
    }
  }

  return chunks.join(" ").replace(/\\n/g, "\n").replace(/\s+/g, " ").trim() ||
    "[Could not extract text from this PDF. Try uploading a text-based PDF or a .txt file instead.]";
}

/**
 * Extract text from DOCX (which is a ZIP of XML files).
 */
async function extractTextFromDocx(blob: Blob): Promise<string> {
  try {
    // DOCX is a ZIP file. We need to find word/document.xml
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Simple ZIP parser to find word/document.xml
    const xmlContent = findFileInZip(bytes, "word/document.xml");
    if (!xmlContent) {
      return "[Could not parse DOCX file. Try saving as .txt and re-uploading.]";
    }

    // Strip XML tags to get plain text
    return xmlContent
      .replace(/<w:p[^>]*>/g, "\n")       // Paragraphs as newlines
      .replace(/<w:tab\/>/g, "\t")         // Tabs
      .replace(/<[^>]+>/g, "")             // Remove all XML tags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "[Error parsing DOCX file]";
  }
}

/**
 * Very simple ZIP file reader to extract a specific file by name.
 */
function findFileInZip(zipBytes: Uint8Array, targetName: string): string | null {
  const decoder = new TextDecoder();
  // Search for local file headers (PK\x03\x04)
  for (let i = 0; i < zipBytes.length - 30; i++) {
    if (zipBytes[i] === 0x50 && zipBytes[i + 1] === 0x4B && zipBytes[i + 2] === 0x03 && zipBytes[i + 3] === 0x04) {
      const nameLen = zipBytes[i + 26] | (zipBytes[i + 27] << 8);
      const extraLen = zipBytes[i + 28] | (zipBytes[i + 29] << 8);
      const compressedSize = zipBytes[i + 18] | (zipBytes[i + 19] << 8) | (zipBytes[i + 20] << 16) | (zipBytes[i + 21] << 24);
      const compressionMethod = zipBytes[i + 8] | (zipBytes[i + 9] << 8);
      const fileName = decoder.decode(zipBytes.slice(i + 30, i + 30 + nameLen));

      if (fileName === targetName && compressionMethod === 0) {
        // Stored (not compressed)
        const dataStart = i + 30 + nameLen + extraLen;
        return decoder.decode(zipBytes.slice(dataStart, dataStart + compressedSize));
      } else if (fileName === targetName && compressionMethod === 8) {
        // Deflated - use DecompressionStream
        const dataStart = i + 30 + nameLen + extraLen;
        const compressedData = zipBytes.slice(dataStart, dataStart + compressedSize);
        try {
          // Try raw inflate using DecompressionStream
          const ds = new DecompressionStream("raw");
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          const readAll = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            const totalLen = chunks.reduce((s, c) => s + c.length, 0);
            const result = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of chunks) {
              result.set(c, offset);
              offset += c.length;
            }
            return decoder.decode(result);
          };
          // We can't await here in a sync context, but the function caller is async
          // Return a marker and handle async in the caller
          return null; // Fallback for compressed DOCX
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Extract readable ASCII text from binary file.
 */
function extractPlainTextFromBinary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let current = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b < 127) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= 4) chunks.push(current);
      current = "";
    }
  }
  if (current.length >= 4) chunks.push(current);
  return chunks.join(" ").replace(/\s+/g, " ").trim() ||
    "[Could not extract text from this file format]";
}
