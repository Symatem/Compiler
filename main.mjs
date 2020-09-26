import { LLVMTypeCache } from './LLVM/Type.js';
import { LLVMBasicBlock } from './LLVM/Value.js';
import { LLVMModule } from './LLVM/Module.js';
import { bundleOperands, operandsToLlvmValues } from './values.js';
import { hashOfOperands, buildLlvmBundle, unbundleAndMixOperands, customOperator } from './utils.js';
import { throwError, pushStackFrame } from './stackTrace.js';
import { typedPlaceholderCache, primitiveLookupMap, initializeBackend } from './symbols.js';
import { SymbolInternals, Utils } from '../SymatemJS/SymatemJS.mjs';


export class CompilerContext {
    constructor(backend) {
        initializeBackend(backend);
        this.backend = backend;
        this.typedPlaceholderCache = new Map(typedPlaceholderCache);
        this.operatorInstanceBySymbol = new Map();
        this.operatorInstanceByHash = new Map();
        this.stackHeight = 0;
        this.logMessages = [];
        this.llvmModule = new LLVMModule('Symatem');
        this.namespaceId = SymbolInternals.identityOfSymbol(backend.createSymbol(backend.metaNamespaceIdentity));
    }

    getLlvmCode() {
        return this.llvmModule.serialize();
    }

    execute(inputOperands, isProgramEntry) {
        const entry = {'inputOperands': inputOperands};
        entry.operator = entry.inputOperands.get(this.backend.symbolByName.Operator);
        entry.inputOperands = Utils.sorted(entry.inputOperands);
        entry.hash = hashOfOperands(this, entry.inputOperands);
        if(this.operatorInstanceByHash.has(entry.hash))
            return this.operatorInstanceByHash.get(entry.hash);
        entry.symbol = this.backend.createSymbol(this.namespaceId);
        pushStackFrame(this, entry, 'Begin');
        entry.outputOperands = new Map();
        entry.aux = {
            'llvmBasicBlock': new LLVMBasicBlock(),
            'inputLlvmValues': operandsToLlvmValues(this, entry.inputOperands)
        };
        entry.aux.llvmFunctionParameters = Array.from(entry.aux.inputLlvmValues.values());
        unbundleAndMixOperands(this, entry, 'input');
        entry.inputOperands.delete(this.backend.symbolByName.Operator);
        entry.inputOperandBundle = bundleOperands(this, entry.inputOperands);
        entry.aux.inputLlvmValueBundle = buildLlvmBundle(this, entry.aux.llvmBasicBlock, Array.from(entry.aux.inputLlvmValues.values()));
        this.backend.setTriple([entry.symbol, this.backend.symbolByName.Type, this.backend.symbolByName.OperatorInstance], true);
        this.backend.setTriple([entry.symbol, this.backend.symbolByName.Operator, entry.operator], true);
        this.backend.setTriple([entry.symbol, this.backend.symbolByName.InputOperandBundle, entry.inputOperandBundle], true);
        this.operatorInstanceBySymbol.set(entry.symbol, entry);
        this.operatorInstanceByHash.set(entry.hash, entry);
        if(!entry.operator || entry.operator === this.backend.symbolByName.Void)
            throwError(this, entry.symbol, 'Tried calling Void as Operator');
        const primitive = primitiveLookupMap.get(entry.operator);
        ((primitive) ? primitive : customOperator)(this, entry);
        if(isProgramEntry) {
            if(entry.aux)
                throwError(this, entry.symbol, 'Encountered recursion cycle which could not be resolved');
            if(entry.llvmFunction) {
                delete entry.llvmFunction.linkage;
                entry.llvmFunction.name = this.backend.getData(entry.operator);
            }
        }
        return entry;
    }
}
