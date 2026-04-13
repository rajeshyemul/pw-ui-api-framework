import { defineConfig } from '@playwright/test';
import path from 'path';
import { PathConstants } from '../../support/constants/PathConstants';
import { SetupConstants } from '../../support/constants/SetupConstants';

const reportRoot = process.env.REPORT_ROOT || path.join(process.cwd(), 'reports');

export default defineConfig({
  reporter: [
    [
      'html',
      {
        open: SetupConstants.NEVER,
        title: SetupConstants.HTML_REPORT_TITLE,
        outputFolder: path.join(reportRoot, PathConstants.HTML_REPORTS_PATH),
        noSnippets: true,
      },
    ],
    ['json', { outputFile: path.join(reportRoot, PathConstants.JSON_REPORTS_PATH) }],
    ['junit', { outputFile: path.join(reportRoot, PathConstants.JUNIT_REPORTS_PATH) }],
  ],
});
