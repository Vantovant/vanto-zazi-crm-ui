import { defineTool } from '@lovable.dev/mcp-js';
import { scorecardSaveFields } from '../../duplicationScorecardMcp';
import { runTool } from '../run';

export default defineTool({
  name: 'save_duplication_scorecard',
  title: 'Save duplication scorecard',
  description: 'WRITES: saves or updates one of your own weekly scorecards, changing only provided fields; dry_run previews without writing, and rating is never auto-set.',
  inputSchema: scorecardSaveFields,
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (input, ctx) => runTool('save_duplication_scorecard', input, ctx),
});