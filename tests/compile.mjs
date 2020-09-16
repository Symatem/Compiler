import { JavaScriptBackend } from '../SymatemJS/SymatemJS.mjs';
import { CompilerContext } from '../main.mjs';
import FS from 'fs';

const context = new CompilerContext(new JavaScriptBackend()),
      srcCode = FS.readFileSync(process.argv[2]).toString(),
      inputs = eval(srcCode);
try {
    const outputs = context.execute(inputs, true);
    FS.writeFileSync(process.argv[3], context.llvmCode());
} catch(error) {
    console.error(context.logMessages.join('\n'), error);
}
