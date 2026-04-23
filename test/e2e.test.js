const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

const BOOK_DIR = path.resolve(__dirname, 'fixtures/test-book');
const BOOK_OUTPUT = path.join(BOOK_DIR, '_book');
const PLUGIN_ROOT = path.resolve(__dirname, '..');
// Symlink is placed in the project's own node_modules so that Node's module
// resolution (which walks up from honkit's lib path) can find the plugin.
const SYMLINK_PATH = path.join(PLUGIN_ROOT, 'node_modules', 'gitbook-plugin-mermaid-newface');

const execOpts = { cwd: BOOK_DIR, stdio: 'pipe', timeout: 120000 };

function hasCalibre() {
  try {
    execSync('which ebook-convert', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

beforeAll(() => {
  // Create self-referential symlink:
  // <project>/node_modules/gitbook-plugin-mermaid-newface -> <project>
  fs.mkdirSync(path.join(PLUGIN_ROOT, 'node_modules'), { recursive: true });
  if (fs.existsSync(SYMLINK_PATH)) {
    fs.rmSync(SYMLINK_PATH, { recursive: true });
  }
  fs.symlinkSync(PLUGIN_ROOT, SYMLINK_PATH, 'dir');

  // Build the book (website output)
  execSync('npx honkit build', execOpts);
});

afterAll(() => {
  // Clean up build output and symlink
  if (fs.existsSync(BOOK_OUTPUT)) {
    fs.rmSync(BOOK_OUTPUT, { recursive: true });
  }
  if (fs.existsSync(SYMLINK_PATH)) {
    fs.rmSync(SYMLINK_PATH, { recursive: true });
  }
});

describe('Website (HTML/SVG) output', () => {
  let $;

  beforeAll(() => {
    const html = fs.readFileSync(path.join(BOOK_OUTPUT, 'index.html'), 'utf-8');
    $ = cheerio.load(html);
  });

  test('flowchart is rendered as SVG', () => {
    const svgs = $('svg');
    // At least one SVG should contain mermaid flowchart content
    const hasMermaidSvg = svgs.toArray().some(svg => {
      const content = $(svg).html();
      return content.includes('Start') || content.includes('End');
    });
    expect(hasMermaidSvg).toBe(true);
  });

  test('sequence diagram is rendered as SVG', () => {
    const svgs = $('svg');
    const hasSequenceSvg = svgs.toArray().some(svg => {
      const content = $(svg).html();
      return content.includes('Alice') || content.includes('Bob');
    });
    expect(hasSequenceSvg).toBe(true);
  });

  test('normal code block is NOT converted to SVG', () => {
    const codeBlocks = $('code');
    const hasJsBlock = codeBlocks.toArray().some(el => {
      return $(el).text().includes('console.log');
    });
    expect(hasJsBlock).toBe(true);
  });
});

const describePdf = hasCalibre() ? describe : describe.skip;

describePdf('PDF (PNG data URI) output', () => {
  const pdfPath = path.join(BOOK_DIR, 'output.pdf');

  beforeAll(() => {
    execSync('npx honkit pdf . output.pdf', execOpts);
  });

  afterAll(() => {
    if (fs.existsSync(pdfPath)) {
      fs.rmSync(pdfPath);
    }
  });

  test('honkit pdf completes successfully', () => {
    expect(fs.existsSync(pdfPath)).toBe(true);
  });

  test('output PDF has non-trivial file size', () => {
    const stats = fs.statSync(pdfPath);
    // A PDF with embedded PNG diagrams should be at least a few KB
    expect(stats.size).toBeGreaterThan(1024);
  });
});
