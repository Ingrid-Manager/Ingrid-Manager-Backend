import { registerDecorator, ValidationOptions } from 'class-validator';

export function isHalfDegreeStep(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value * 2)
  );
}

/* FRITZ!DECT-Thermostate akzeptieren nur Sollwerte in 0,5-°C-Schritten. */
export function IsHalfDegreeStep(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isHalfDegreeStep',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} muss in 0,5-°C-Schritten angegeben werden`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isHalfDegreeStep(value),
      },
    });
  };
}
