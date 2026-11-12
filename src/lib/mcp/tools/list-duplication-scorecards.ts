import { defineTool } from '@lovable.dev/mcp-js';
import { scorecardListFields } from '../../duplicationScorecardMcp';
import { runTool } from '../run';

export default defineTool({
  name: 'list_duplication_scorecards',
  title: 'List duplication scorecards',
  description: 'READ ONLY: lists your own saved weekly scorecards with all fields, newest first.',
  inputSchema: scorecardListFields,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool('list_duplication_scorecards', input, ctx),
});