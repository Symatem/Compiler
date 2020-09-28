import { primitiveDeferEvaluation, primitiveBundle, primitiveUnbundle,
primitiveStackAllocate, primitiveLoad, primitiveStore, primitiveConversion,
primitiveDivision, primitiveBinaryInstruction, compileBitShift, compileBinaryArithmetic, compileBinaryComparison,
primitiveIf } from './primitives.mjs';


export const typedPlaceholderCache = new Map();
export let llvmLookupMaps, primitiveLookupMap;
export function initializeBackend(backend) {
    backend.initPredefinedSymbols();

    const sbn = backend.symbolByName;
    if(sbn.Compiler)
        return;
    const namespaceId = backend.registerNamespaces({'Compiler': [
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
        'SixtyFour',
        'Vector',
        'Pointer',
        'Symbol',
        'Boolean',
        'Natural32',
        'Integer32',
        'Float32',
        'Natural64',
        'Integer64',
        'Float64',

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
        'NumericConversion',
        'Reinterpretation',

        'MultiplyByPowerOfTwo',
        'DivideByPowerOfTwo',
        'Exponent',
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
    ]}).Compiler;
    backend.setData(sbn.Zero, 0);
    backend.setData(sbn.One, 1);
    backend.setData(sbn.Two, 2);
    backend.setData(sbn.Four, 4);
    backend.setData(sbn.Eight, 8);
    backend.setData(sbn.Sixteen, 16);
    backend.setData(sbn.ThirtyTwo, 32);
    backend.setData(sbn.SixtyFour, 64);
    function setupTypedPlaceholder(typedPlaceholder, size, encoding, count=sbn.One) {
        const placeholderEncoding = backend.createSymbol(namespaceId);
        backend.setTriple([typedPlaceholder, sbn.Type, sbn.TypedPlaceholder], true);
        backend.setTriple([typedPlaceholder, sbn.PlaceholderEncoding, placeholderEncoding], true);
        backend.setTriple([placeholderEncoding, sbn.Type, sbn.Composite], true);
        if(count != sbn.Void)
            backend.setTriple([placeholderEncoding, sbn.Count, count], true);
        backend.setTriple([placeholderEncoding, sbn.SlotSize, size], true);
        backend.setTriple([placeholderEncoding, sbn.Default, encoding], true);
        typedPlaceholderCache.set(encoding+','+backend.getData(size), typedPlaceholder);
    }
    setupTypedPlaceholder(sbn.Pointer, sbn.Eight, sbn.BinaryNumber, sbn.Void);
    setupTypedPlaceholder(sbn.Symbol, sbn.ThirtyTwo, sbn.BinaryNumber, sbn.Two);
    setupTypedPlaceholder(sbn.Boolean, sbn.One, sbn.BinaryNumber);
    setupTypedPlaceholder(sbn.Natural32, sbn.ThirtyTwo, sbn.BinaryNumber);
    setupTypedPlaceholder(sbn.Integer32, sbn.ThirtyTwo, sbn.TwosComplement);
    setupTypedPlaceholder(sbn.Float32, sbn.ThirtyTwo, sbn.IEEE754);
    setupTypedPlaceholder(sbn.Natural64, sbn.SixtyFour, sbn.BinaryNumber);
    setupTypedPlaceholder(sbn.Integer64, sbn.SixtyFour, sbn.TwosComplement);
    setupTypedPlaceholder(sbn.Float64, sbn.SixtyFour, sbn.IEEE754);
    llvmLookupMaps = {
        divisionPrefix: new Map([
            [sbn.BinaryNumber, 'u'],
            [sbn.TwosComplement, 's'],
            [sbn.IEEE754, 'f']
        ]),
        binaryArithmetic: new Map([
            [sbn.And, 'and'],
            [sbn.Or, 'or'],
            [sbn.Xor, 'xor'],
            [sbn.Addition, 'add'],
            [sbn.Subtraction, 'sub'],
            [sbn.Multiplication, 'mul']
        ]),
        binaryComparison: new Map([
            [sbn.Equal, 'eq'],
            [sbn.NotEqual, 'ne'],
            [sbn.LessThan, 'lt'],
            [sbn.LessEqual, 'le'],
            [sbn.GreaterThan, 'gt'],
            [sbn.GreaterEqual, 'ge']
        ]),
        binaryComparisonPrefix: new Map([
            [sbn.BinaryNumber, 'u'],
            [sbn.TwosComplement, 's'],
            [sbn.IEEE754, 'o']
        ])
    };
    primitiveLookupMap = new Map([
        [sbn.DeferEvaluation, primitiveDeferEvaluation],
        [sbn.Bundle, primitiveBundle],
        [sbn.Unbundle, primitiveUnbundle],
        [sbn.StackAllocate, primitiveStackAllocate],
        [sbn.Load, primitiveLoad],
        [sbn.Store, primitiveStore],
        [sbn.NumericConversion, primitiveConversion.bind(undefined, true)],
        [sbn.Reinterpretation, primitiveConversion.bind(undefined, false)],
        [sbn.MultiplyByPowerOfTwo, primitiveBinaryInstruction.bind(undefined, compileBitShift, (a, b) => (a<<b), sbn.Input, sbn.Exponent)],
        [sbn.DivideByPowerOfTwo, primitiveBinaryInstruction.bind(undefined, compileBitShift, (a, b) => (a>>b), sbn.Input, sbn.Exponent)],
        [sbn.And, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a&b), sbn.Input, sbn.OtherInput)],
        [sbn.Or, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a|b), sbn.Input, sbn.OtherInput)],
        [sbn.Xor, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a^b), sbn.Input, sbn.OtherInput)],
        [sbn.Addition, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a+b), sbn.Input, sbn.OtherInput)],
        [sbn.Subtraction, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a-b), sbn.Minuend, sbn.Subtrahend)],
        [sbn.Multiplication, primitiveBinaryInstruction.bind(undefined, compileBinaryArithmetic, (a, b) => (a*b), sbn.Input, sbn.OtherInput)],
        [sbn.Division, primitiveDivision],
        [sbn.Equal, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a==b), sbn.Input, sbn.Comparand)],
        [sbn.NotEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a!=b), sbn.Input, sbn.Comparand)],
        [sbn.LessThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<b), sbn.Input, sbn.Comparand)],
        [sbn.LessEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a<=b), sbn.Input, sbn.Comparand)],
        [sbn.GreaterThan, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>b), sbn.Input, sbn.Comparand)],
        [sbn.GreaterEqual, primitiveBinaryInstruction.bind(undefined, compileBinaryComparison, (a, b) => (a>=b), sbn.Input, sbn.Comparand)],
        [sbn.If, primitiveIf],
    ]);
}
