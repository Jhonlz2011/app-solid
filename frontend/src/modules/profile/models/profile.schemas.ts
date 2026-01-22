// Profile Form Schemas - Valibot with tree-shaking optimized imports
import {
    object,
    pipe,
    string,
    trim,
    minLength,
    maxLength,
    email,
    forward,
    partialCheck
} from 'valibot';

// ============================================
// Update Profile Schema
// ============================================

export const UpdateProfileSchema = object({
    username: pipe(
        string(),
        trim(),
        minLength(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
        maxLength(50, 'El nombre de usuario no puede exceder 50 caracteres')
    ),
    email: pipe(
        string(),
        trim(),
        email('Ingresa un email válido')
    ),
});

// ============================================
// Change Password Schema
// ============================================

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
    // Cross-field validation: passwords must match
    forward(
        partialCheck(
            [['newPassword'], ['confirmPassword']],
            (input) => input.newPassword === input.confirmPassword,
            'Las contraseñas no coinciden'
        ),
        ['confirmPassword']
    )
);