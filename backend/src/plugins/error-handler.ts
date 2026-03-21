import { Elysia } from 'elysia';
import { DomainError } from '../services/errors';

// PG column name -> camelCase form field mapping
const PG_COLUMN_TO_FIELD: Record<string, string> = {
  tax_id: 'taxId',
  business_name: 'businessName',
  email_billing: 'emailBilling',
  trade_name: 'tradeName',
  tax_id_type: 'taxIdType',
  person_type: 'personType',
  email: 'email',
  username: 'username',
  phone: 'phone',
};

/** Extract field name from PG constraint detail string: "Key (tax_id)=(xxx) already exists" */
function extractConstraintField(detail?: string): string | null {
  if (!detail) return null;
  const match = detail.match(/Key \((\w+)\)/);
  if (!match) return null;
  return PG_COLUMN_TO_FIELD[match[1]] || match[1];
}

export const errorHandlerPlugin = new Elysia()
  .onError(({ code, error, set }) => {
    // 1. Domain errors (DomainError & AuthError if it extends DomainError)
    if (error instanceof DomainError) {
      set.status = error.status;
      return {
        code: error.code,
        message: error.message,
        ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
      };
    }

    // 2. Route not found
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { code: 'NOT_FOUND', message: 'Ruta no encontrada' };
    }

    // 3. Elysia TypeBox validation errors
    if (code === 'VALIDATION') {
      set.status = 400;
      const fieldErrors: { field: string; message: string }[] = [];

      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.type === 'validation') {
          const details = Array.isArray(parsed.errors) ? parsed.errors : [parsed];
          for (const detail of details) {
            const path = detail.path?.replace(/^\//, '').replace(/\//g, '.') || 'unknown';
            const msg = detail.message || detail.summary || 'Valor inválido';
            fieldErrors.push({ field: path, message: msg });
          }
        }
      } catch {
        const rawMsg = error.message || 'Datos inválidos';
        fieldErrors.push({ field: 'form', message: rawMsg });
      }

      return {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        ...(fieldErrors.length > 0 ? { errors: fieldErrors } : {}),
      };
    }

    // 4. PostgreSQL / Drizzle DB errors (Bubble up)
    const pgError = error as any;
    if (pgError?.code === '23505') {
      // Unique constraint violation
      set.status = 409;
      const field = extractConstraintField(pgError.detail);
      return {
        code: 'DUPLICATE_ENTRY',
        message: 'Ya existe un registro con estos datos',
        errors: field ? [{ field, message: 'Este valor ya está registrado' }] : [],
      };
    }
    if (pgError?.code === '23503') {
      // Foreign key violation
      set.status = 409;
      return {
        code: 'CONFLICT',
        message: 'No se puede completar la operación: existen registros relacionados',
      };
    }
    if (pgError?.code === '23502') {
      // Not-null violation
      set.status = 400;
      const column = pgError.column || 'unknown';
      return {
        code: 'VALIDATION_ERROR',
        message: `El campo '${column}' es obligatorio`,
        errors: [{ field: column, message: 'Este campo es obligatorio' }],
      };
    }

    console.error('Unhandled error:', error);
    set.status = 500;
    return { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' };
  });
