import { JavaScriptBackend } from '../SymatemJS/SymatemJS.mjs';
import { CompilerContext } from '../src/main.mjs';
import {readFileSync,writeFileSync} from 'fs';

const context = new CompilerContext(new JavaScriptBackend()),
      srcCode = readFileSync(process.argv[2]).toString(),
      inputs = eval(srcCode);
try {
    const outputs = context.execute(inputs, true);
    writeFileSync(process.argv[3], context.llvmCode());
} catch(error) {
    console.error(context.logMessages.join('\n'), error);
}
