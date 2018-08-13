import { primitiveDeferEvaluation, primitiveBundle, primitiveUnbundle,
primitiveStackAllocate, primitiveLoad, primitiveStore,
primitiveDivision, primitiveBinaryInstruction, compileBinaryArithmetic, compileBinaryComparison,
primitiveIf } from './primitives.js';
import BasicBackend from '../SymatemJS/BasicBackend.js';


export const typedPlaceholderCache = new Map();
export let llvmLookupMaps, primitiveLookupMap;
export function initializeOntology(ontology) {
    if(BasicBackend.symbolByName.Compiler)
        return;
    const namespaceId = ontology.registerAdditionalSymbols('Compiler', [
        'Operator',
        'OperatorInstance',
        'Operation',
        'Carrier',
        'Element',
        'Operand',
        'OperandTag',
        'OperandBundle',
        'InputOperandBundle',
        'OutputOperandBundle',

        'SourceOperat',
        'DestinationOperat',
        'SourceOperandTag',
        'DestinationOperandTag',
        'TypedPlaceholder',
        'Constant',

        'PlaceholderEncoding',
        'Zero',
        'One',
        'Two',
        'Four',
        'Eight',
        'Sixteen',
        'ThirtyTwo',
        'Vector',
        'Pointer',
        'Symbol',
        'Boolean',
        'Natural32',
        'Integer32',
        'Float32',

        'Input',
        'OtherInput',
        'Output',

        'DeferEvaluation',
        'Bundle',
        'Unbundle',

        'StackAllocate',
        'Load',
        'Store',
        'Address',

        'And',
        'Or',
        'Xor',

        'Addition',
        'Subtraction',
        'Minuend',
        'Subtrahend',
        'Multiplication',
        'Division',
        'Dividend',
        'Divisor',
        'Quotient',
        'Rest',

        'Comparand',
        'Equal',
        'NotEqual',
        'LessThan',
        'LessEqual',
        'GreaterThan',
        'GreaterEqual',

        'If',
        'Condition',
        'Then',
        'Else',
    ]);
    ontology.setData(BasicBackend.symbolByName.Zero, 0);
    ontology.setData(BasicBackend.symbolByName.One, 1);
    ontology.setData(BasicBackend.symbolByName.Two, 2);
    ontology.setData(BasicBackend.symbolByName.Four, 4);
    ontology.setData(BasicBackend.symbolByName.Eight, 8);
    ontology.setData(BasicBackend.symbolByName.Sixteen, 16);
    ontology.setData(BasicBackend.symbolByName.ThirtyTwo, 32);
    function setupTypedPlaceholder(typedPlaceholder, size, encoding, count=BasicBackend.symbolByName.One) {
        const placeholderEncoding = ontology.createSymbol(namespaceId);
        ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.TypedPlaceholder], true);
        ontology.setTriple([typedPlaceholder, BasicBackend.symbolByName.PlaceholderEncoding, placeholderEncoding], true);
        ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Type, BasicBackend.symbolByName.Composite], true);
        if(count != BasicBackend.symbolByName.Void)
            ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Count, count], true);
        ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.SlotSize, size], true);
        ontology.setTriple([placeholderEncoding, BasicBackend.symbolByName.Default, encoding], true);
        typedPlaceholderCache.set(encoding+','+ontology.getData(size), typedPlaceholder);
    }
    setupTypedPlaceholder(BasicBackend.symbolByName.Pointer, BasicBackend.symbolByName.Eight, BasicBackend.symbolByName.BinaryNumber, BasicBackend.symbolByName.Void);
    setupTypedPlaceholder(BasicBackend.symbolByName.Symbol, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber, BasicBackend.symbolByName.Two);
    setupTypedPlaceholder(BasicBackend.symbolByName.Boolean, BasicBackend.symbolByName.One, BasicBackend.symbolByName.BinaryNumber);
    setupTypedPlaceholder(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.BinaryNumber);
    setupTypedPlaceholder(BasicBackend.symbolByName.Integer32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.TwosComplement);
    setupTypedPlaceholder(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.ThirtyTwo, BasicBackend.symbolByName.IEEE754);
    llvmLookupMaps = {
        divisionPrefix: new Map([
            [BasicBackend.symbolByName.BinaryNumber, 'u'],
            [BasicBackend.symbolByName.TwosComplement, 's'],
            [BasicBackend.symbolByName.IEEE754, 'f']
        ]),
        binaryArithmetic: new Map([
            [BasicBackend.symbolByName.And, 'and'],
            [BasicBackend.symbolByName.Or, 'or'],
            [BasicBackend.symbolByName.Xor, 'xor'],
            [BasicBackend.symbolByName.Addition, 'add'],
            [BasicBackend.symbolByName.Subtraction, 'sub'],
            [BasicBackend.symbolByName.Multiplication, 'mul']
        ]),
        binaryComparison: new Map([
            [BasicBackend.symbolByName.Equal, 'eq'],
            [BasicBackend.symbolByName.NotEqual, 'ne'],
            [BasicBackend.symbolByName.LessThan, 'lt'],
            [BasicBackend.symbolByName.LessEqual, 'le'],
            [BasicBackend.symbolByName.GreaterThan, 'gt'],
            [BasicBackend.symbolByName.GreaterEqual, 'ge']
        ]),
        binaryComparisonPrefix: new Map([
            [BasicBackend.symbolByName.BinaryNumber, 'u'],
            [BasicBackend.symbolByName.TwosComplement, 's'],
            [BasicBackend.symbolByName.IEEE754, 'o']
        ])
    };
    primitiveLookupMap = new Map([
        [BasicBackend.symbolByName.DeferEvaluation, primitiveDeferEvaluation],
        [BasicBackend.symbolByName.Bundle, primitiveBundle],
        [BasicBackend.symbolByName.Unbundle, primitiveUnbundle],
        [BasicBackend.symbolByName.StackAllocate, primitiveStackAllocate],
        [BasicBackend.symbolByName.Load, primitiveLoad],
        [BasicBackend.symbolByName.Store, primitiveStore],
        [BasicBackend.symbolByName.And, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a&b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Or, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a|b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Xor, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a^b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Addition, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a+b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Subtraction, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a-b), BasicBackend.symbolByName.Minuend, BasicBackend.symbolByName.Subtrahend)],
        [BasicBackend.symbolByName.Multiplication, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a*b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.OtherInput)],
        [BasicBackend.symbolByName.Division, primitiveDivision],
        [BasicBackend.symbolByName.Equal, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a==b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.NotEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a!=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.LessThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.LessEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.GreaterThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.GreaterEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>=b), BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Comparand)],
        [BasicBackend.symbolByName.If, primitiveIf],
    ]);
}
