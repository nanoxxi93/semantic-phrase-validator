export class InvalidVectorDimensionError extends Error {
  constructor(expected: number, actualA: number, actualB: number) {
    super(
      `Invalid vector dimension: expected both vectors to have dimension ${expected}, but got dimensions ${actualA} and ${actualB}.`
    );
    this.name = 'InvalidVectorDimensionError';
  }
}
