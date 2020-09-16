function(program) {
    const [fisrOperator, fisrOperations] = program.createOperator(9),
          encodingNatural32 = program.backend.getPairOptionally(program.backend.symbolByName.Natural32, program.backend.symbolByName.PlaceholderEncoding),
          encodingFloat32 = program.backend.getPairOptionally(program.backend.symbolByName.Float32, program.backend.symbolByName.PlaceholderEncoding);

    program.backend.setData(fisrOperator, 'FastInverseSquareRoot');
    program.createCarrier(fisrOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.Reinterpretation);
    program.createCarrier(fisrOperations[0], program.backend.symbolByName.Input, fisrOperator, program.backend.symbolByName.Input);
    program.createCarrier(fisrOperations[0], program.backend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(fisrOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[1], program.backend.symbolByName.Input, fisrOperator, program.backend.symbolByName.Input);
    program.createCarrier(fisrOperations[1], program.backend.symbolByName.OtherInput, program.createOperand(0.5), true);
    program.createCarrier(fisrOperations[2], program.backend.symbolByName.Operator, program.backend.symbolByName.DivideByPowerOfTwo);
    program.createCarrier(fisrOperations[2], program.backend.symbolByName.Input, fisrOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[2], program.backend.symbolByName.Exponent, program.backend.symbolByName.One, true);
    program.createCarrier(fisrOperations[3], program.backend.symbolByName.Operator, program.backend.symbolByName.Subtraction);
    program.createCarrier(fisrOperations[3], program.backend.symbolByName.Minuend, fisrOperations[2], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[3], program.backend.symbolByName.Subtrahend, program.createOperand(0x5F3759DF), true);
    program.createCarrier(fisrOperations[4], program.backend.symbolByName.Operator, program.backend.symbolByName.Reinterpretation);
    program.createCarrier(fisrOperations[4], program.backend.symbolByName.Input, fisrOperations[3], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[4], program.backend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(fisrOperations[5], program.backend.symbolByName.Operator, program.backend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[5], program.backend.symbolByName.Input, fisrOperations[1], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[5], program.backend.symbolByName.OtherInput, fisrOperations[4], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[6], program.backend.symbolByName.Operator, program.backend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[6], program.backend.symbolByName.Input, fisrOperations[5], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[6], program.backend.symbolByName.OtherInput, fisrOperations[4], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[7], program.backend.symbolByName.Operator, program.backend.symbolByName.Subtraction);
    program.createCarrier(fisrOperations[7], program.backend.symbolByName.Minuend, program.createOperand(1.5), true);
    program.createCarrier(fisrOperations[7], program.backend.symbolByName.Subtrahend, fisrOperations[6], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[8], program.backend.symbolByName.Operator, program.backend.symbolByName.Multiplication);
    program.createCarrier(fisrOperations[8], program.backend.symbolByName.Input, fisrOperations[7], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperations[8], program.backend.symbolByName.OtherInput, fisrOperations[4], program.backend.symbolByName.Output);
    program.createCarrier(fisrOperator, program.backend.symbolByName.Output, fisrOperations[8], program.backend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(program.backend.symbolByName.Operator, fisrOperator);
    inputs.set(program.backend.symbolByName.Input, program.backend.symbolByName.Float32);
    return inputs;
}
