import { pipe, string, minLength, maxLength, trim, email, object, forward, partialCheck, type InferInput } from 'valibot';

// --- PROFILE FORM SCHEMAS ---
export const UpdateProfileSchema = object({
    username: pipe(
        string(),
        trim(),
        minLength(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
        maxLength(25, 'El nombre de usuario no puede exceder 25 caracteres')
    ),
    email: pipe(
        string(),
        trim(),
        email('Ingresa un email válido')
    ),
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
