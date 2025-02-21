import coverageExclusions from './coverageExclusions.mjs';

export default {
  'sonar.projectKey': 'WordToPdf',

  'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
  'sonar.testExecutionReportPaths': 'coverage/test-report.xml',

  'sonar.sources': ['src'].join(','),
  // SonarQube supports limited wildcards (https://docs.sonarqube.org/latest/project-administration/narrowing-the-focus).
  // Exclude test files from analysis.
  'sonar.exclusions': ['**/*.test.*'].join(','),

  'sonar.coverage.exclusions': coverageExclusions.join(','),
};
