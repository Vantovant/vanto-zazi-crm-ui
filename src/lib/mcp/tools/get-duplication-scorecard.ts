import { defineTool } from '@lovable.dev/mcp-js';
import { scorecardGetFields } from '../../duplicationScorecardMcp';
import { runTool } from '../run';

export default defineTool({
  name: 'get_duplication_scorecard',
  title: 'Get duplication scorecard',
  description: 'READ ONLY: reads your own weekly scorecard and previous week, with a suggested rating that is never saved.',
  inputSchema: scorecardGetFields,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool('get_duplication_scorecard', input, ctx),
});