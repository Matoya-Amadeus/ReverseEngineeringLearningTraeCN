#!/usr/bin/env python3
import re
import json
import sys

def simple_beautify(js_code):
    """简单的 JavaScript 美化函数"""
    # 添加换行
    js_code = re.sub(r';\s*', ';\n', js_code)
    js_code = re.sub(r'}\s*', '}\n', js_code)
    js_code = re.sub(r'{\s*', '{\n', js_code)
    
    # 缩进
    lines = js_code.split('\n')
    indent = 0
    result = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if line.startswith('}'):
            indent -= 1
        
        result.append('    ' * indent + line)
        
        if line.endswith('{'):
            indent += 1
    
    return '\n'.join(result)

def main():
    if len(sys.argv) < 2:
        print("Usage: python beautify_js.py <input_file> [output_file]")
        return 1
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file + '.beautified.js'
    
    try:
        with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
            js_code = f.read()
        
        beautified = simple_beautify(js_code)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(beautified)
        
        print(f"Beautified {input_file} -> {output_file}")
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
