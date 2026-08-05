// This file now serves as a facade to maintain backwards compatibility 
// with existing routes, while delegating to the segregated CQRS services.

export * from './entities/entities.query.service';
export * from './entities/entities.command.service';
