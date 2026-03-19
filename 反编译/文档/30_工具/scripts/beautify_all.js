const fs = require('fs');
const path = require('path');
const beautify = require('js-beautify');

const options = {
    indent_size: 2,
    space_in_empty_paren: true,
    max_preserve_newlines: 2,
    brace_style: 'collapse',
    keep_array_indentation: false,
    break_chained_methods: false,
    indent_scripts: 'normal',
    wrap_line_length: 0,
    e4x: false,
    end_with_newline: true,
    comma_first: false,
    operator_position: 'before-newline'
};

function beautifyFile(inputPath, outputPath) {
    try {
        console.log(`Beautifying ${inputPath}...`);
        const content = fs.readFileSync(inputPath, 'utf8');
        const beautified = beautify.js(content, options);
        fs.writeFileSync(outputPath, beautified, 'utf8');
        console.log(`Saved to ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error beautifying ${inputPath}:`, error.message);
        return false;
    }
}

const jsDir = path.join(__dirname, 'javascript');

beautifyFile(
    path.join(jsDir, 'ai-completion-extension.js'),
    path.join(jsDir, 'ai-completion-extension.beautified.js')
);

beautifyFile(
    path.join(jsDir, 'vscode-main.js'),
    path.join(jsDir, 'vscode-main.beautified.js')
);

console.log('Done!');
