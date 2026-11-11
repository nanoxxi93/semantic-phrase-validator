export class InvalidVectorDimensionError extends Error {
  constructor(dimA: number, dimB: number, expected?: number) {
    const message =
      expected !== undefined
        ? `Invalid vector dimension: expected both vectors to have dimension ${expected}, but got dimensions ${dimA} and ${dimB}.`
        : `Invalid vector dimension: vectors must have identical positive dimensions, but got dimensions ${dimA} and ${dimB}.`;
    super(message);
    this.name = 'InvalidVectorDimensionError';
  }
}
