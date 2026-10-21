export class EmptyTextError extends Error {
  constructor(message: string = 'Text cannot be empty or contain only whitespace.') {
    super(message);
    this.name = 'EmptyTextError';
  }
}
