export default function(program) {
    const [conversionsOperator, conversionsOperations] = program.createOperator(10),
          encodingNatural32 = program.backend.getPairOptionally(program.backend.symbolByName.Natural32, program.backend.symbolByName.PlaceholderEncoding),
          encodingNatural64 = program.backend.getPairOptionally(program.backend.symbolByName.Natural64, program.backend.symbolByName.PlaceholderEncoding),
          encodingInteger32 = program.backend.getPairOptionally(program.backend.symbolByName.Integer32, program.backend.symbolByName.PlaceholderEncoding),
          encodingInteger64 = program.backend.getPairOptionally(program.backend.symbolByName.Integer64, program.backend.symbolByName.PlaceholderEncoding),
          encodingFloat32 = program.backend.getPairOptionally(program.backend.symbolByName.Float32, program.backend.symbolByName.PlaceholderEncoding),
          encodingFloat64 = program.backend.getPairOptionally(program.backend.symbolByName.Float64, program.backend.symbolByName.PlaceholderEncoding);

    program.backend.setData(conversionsOperator, 'Conversions');
    program.createCarrier(conversionsOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[0], program.backend.symbolByName.Input, conversionsOperator, program.backend.symbolByName.Input);
    program.createCarrier(conversionsOperations[0], program.backend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(conversionsOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[1], program.backend.symbolByName.Input, conversionsOperator, program.backend.symbolByName.Input);
    program.createCarrier(conversionsOperations[1], program.backend.symbolByName.PlaceholderEncoding, encodingInteger32);
    program.createCarrier(conversionsOperations[2], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[2], program.backend.symbolByName.Input, conversionsOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[2], program.backend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperations[3], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[3], program.backend.symbolByName.Input, conversionsOperations[1], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[3], program.backend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperations[4], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[4], program.backend.symbolByName.Input, conversionsOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[4], program.backend.symbolByName.PlaceholderEncoding, encodingNatural64);
    program.createCarrier(conversionsOperations[5], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[5], program.backend.symbolByName.Input, conversionsOperations[1], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[5], program.backend.symbolByName.PlaceholderEncoding, encodingInteger64);
    program.createCarrier(conversionsOperations[6], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[6], program.backend.symbolByName.Input, conversionsOperator, program.backend.symbolByName.Input);
    program.createCarrier(conversionsOperations[6], program.backend.symbolByName.PlaceholderEncoding, encodingFloat64);
    program.createCarrier(conversionsOperations[7], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[7], program.backend.symbolByName.Input, conversionsOperations[4], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[7], program.backend.symbolByName.PlaceholderEncoding, encodingNatural32);
    program.createCarrier(conversionsOperations[8], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[8], program.backend.symbolByName.Input, conversionsOperations[5], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[8], program.backend.symbolByName.PlaceholderEncoding, encodingInteger32);
    program.createCarrier(conversionsOperations[9], program.backend.symbolByName.Operator, program.backend.symbolByName.NumericConversion);
    program.createCarrier(conversionsOperations[9], program.backend.symbolByName.Input, conversionsOperations[6], program.backend.symbolByName.Output);
    program.createCarrier(conversionsOperations[9], program.backend.symbolByName.PlaceholderEncoding, encodingFloat32);
    program.createCarrier(conversionsOperator, program.backend.symbolByName.Output, conversionsOperations[9], program.backend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(program.backend.symbolByName.Operator, conversionsOperator);
    inputs.set(program.backend.symbolByName.Input, program.backend.symbolByName.Float32);
    return inputs;
}
