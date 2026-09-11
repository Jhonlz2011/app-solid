import { pipe, string, minLength, object, forward, partialCheck, type InferInput } from 'valibot';
import { UsernameFormatSchema, EmailFormatSchema } from './auth.schema';

// --- PROFILE FORM SCHEMAS ---
export const UpdateProfileSchema = object({
    username: UsernameFormatSchema,
    email: EmailFormatSchema,
});

export const ChangePasswordSchema = pipe(
    object({
        currentPassword: pipe(
            string(),
            minLength(1, 'La contraseña actual es requerida')
        ),
        newPassword: pipe(
            string(),
            minLength(8, 'La nueva contraseña debe tener al menos 8 caracteres')
        ),
        confirmPassword: pipe(
            string(),
            minLength(1, 'Confirma tu nueva contraseña')
        ),
    }),
    forward(
        partialCheck(
            [['newPassword'], ['confirmPassword']],
            (input) => input.newPassword === input.confirmPassword,
            'Las contraseñas no coinciden'
        ),
        ['confirmPassword']
    )
);

export type UpdateProfileFormData = InferInput<typeof UpdateProfileSchema>;
export type ChangePasswordFormData = InferInput<typeof ChangePasswordSchema>;
