function(program) {
    const [fisrOperator, fisrOperations] = program.createOperator(9),
          encodingNatural32 = program.ontology.getSolitary(BasicBackend.symbolByName.Natural32, BasicBackend.symbolByName.PlaceholderEncoding),
          encodingFloat32 = program.ontology.getSolitary(BasicBackend.symbolByName.Float32, BasicBackend.symbolByName.PlaceholderEncoding);

    program.ontology.setData(fisrOperator, 'FastInverseSquareRoot');
    program.createCarrier(fisrOperations[0], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Reinterpretation);
    program.createCarrier(fisrOperations[0], BasicBackend.symbolByName.Input, fisrOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(fisrOperations[0], BasicBackend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(fisrOperations[1], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[1], BasicBackend.symbolByName.Input, fisrOperator, BasicBackend.symbolByName.Input);
    program.createCarrier(fisrOperations[1], BasicBackend.symbolByName.OtherInput, program.createOperand(0.5), true);
    program.createCarrier(fisrOperations[2], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.DivideByPowerOfTwo);
    program.createCarrier(fisrOperations[2], BasicBackend.symbolByName.Input, fisrOperations[0], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[2], BasicBackend.symbolByName.Exponent, BasicBackend.symbolByName.One, true);
    program.createCarrier(fisrOperations[3], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
    program.createCarrier(fisrOperations[3], BasicBackend.symbolByName.Minuend, fisrOperations[2], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[3], BasicBackend.symbolByName.Subtrahend, program.createOperand(0x5F3759DF), true);
    program.createCarrier(fisrOperations[4], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Reinterpretation);
    program.createCarrier(fisrOperations[4], BasicBackend.symbolByName.Input, fisrOperations[3], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[4], BasicBackend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(fisrOperations[5], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[5], BasicBackend.symbolByName.Input, fisrOperations[1], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[5], BasicBackend.symbolByName.OtherInput, fisrOperations[4], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[6], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[6], BasicBackend.symbolByName.Input, fisrOperations[5], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[6], BasicBackend.symbolByName.OtherInput, fisrOperations[4], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[7], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Subtraction);
    program.createCarrier(fisrOperations[7], BasicBackend.symbolByName.Minuend, program.createOperand(1.5), true);
    program.createCarrier(fisrOperations[7], BasicBackend.symbolByName.Subtrahend, fisrOperations[6], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[8], BasicBackend.symbolByName.Operator, BasicBackend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[8], BasicBackend.symbolByName.Input, fisrOperations[7], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperations[8], BasicBackend.symbolByName.OtherInput, fisrOperations[4], BasicBackend.symbolByName.Output);
    program.createCarrier(fisrOperator, BasicBackend.symbolByName.Output, fisrOperations[8], BasicBackend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(BasicBackend.symbolByName.Operator, fisrOperator);
    inputs.set(BasicBackend.symbolByName.Input, BasicBackend.symbolByName.Float32);
    return inputs;
}
