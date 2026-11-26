import { mkdir, readFile, writeFile } from 'node:fs/promises';

const report = JSON.parse(await readFile('test-results/run.json', 'utf8'));

function collect(suites) {
  return suites.flatMap((suite) => [
    ...suite.specs.flatMap((spec) => spec.tests.map((test) => ({
      title: spec.title,
      results: test.results,
    }))),
    ...collect(suite.suites ?? []),
  ]);
}

const checks = collect(report.suites);
if (checks.length < 12 || checks.some(({ results }) => results.length !== 1 || results[0].status !== 'passed')) {
  throw new Error('Run the full browser suite successfully before generating acceptance evidence.');
}

const audits = Object.fromEntries(await Promise.all(checks.flatMap(({ results }) =>
  results[0].attachments.filter(({ name }) => name.startsWith('axe-')).map(async (attachment) => {
    const body = attachment.body
      ? Buffer.from(attachment.body, 'base64').toString('utf8')
      : await readFile(attachment.path, 'utf8');
    return [attachment.name, JSON.parse(body)];
  }),
)));

if (!audits['axe-desktop'] || !audits['axe-mobile']) throw new Error('Both browser axe scans are required.');

await mkdir('evidence', { recursive: true });
await writeFile('evidence/axe.json', `${JSON.stringify(audits, null, 2)}\n`);

const summary = [
  '# 验收记录',
  '',
  `运行时间（UTC） ${new Date(report.stats.startTime).toISOString()}`,
  '',
  `真实浏览器 Playwright 环境通过 ${checks.length} 项。Node ${process.version}，浏览器通道 ${process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'Playwright Chromium'}。`,
  '',
  '| 检查 | 结果 |',
  '| --- | --- |',
  ...checks.map(({ title }) => `| ${title} | Pass |`),
  '',
  '展开后的面板分别在桌面和移动视口中运行 axe。详细规则、检查引擎和需人工复核的项目见 [axe.json](./axe.json)。',
  '',
];

await writeFile('evidence/acceptance.md', summary.join('\n'));
