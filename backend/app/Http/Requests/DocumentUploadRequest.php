<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\File;

class DocumentUploadRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // L'autorisation sera gérée par la Policy
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'files' => ['required', 'array', 'min:1', 'max:10'],
            'files.*' => [
                'required',
                'file',
                File::types([
                    // Documents
                    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv',
                    // Images
                    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
                    // Archives (optionnel)
                    'zip', 'rar', '7z',
                ])
                    ->max(10 * 1024) // 10 MB max
                    ->min(1), // 1 KB min
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages(): array
    {
        return [
            'files.required' => 'Aucun fichier n\'a été fourni.',
            'files.array' => 'Le format des fichiers est invalide.',
            'files.min' => 'Vous devez uploader au moins un fichier.',
            'files.max' => 'Vous ne pouvez pas uploader plus de 10 fichiers à la fois.',
            'files.*.required' => 'Un fichier est requis.',
            'files.*.file' => 'Le fichier uploadé n\'est pas valide.',
            'files.*.mimes' => 'Type de fichier non autorisé. Types acceptés : PDF, Word, Excel, Images.',
            'files.*.max' => 'Le fichier ne doit pas dépasser :max Ko.',
            'files.*.min' => 'Le fichier doit faire au moins :min Ko.',
        ];
    }

    /**
     * Configure the validator instance.
     *
     * @param  \Illuminate\Validation\Validator  $validator
     * @return void
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Vérification additionnelle : extension réelle vs déclarée
            if ($this->hasFile('files')) {
                foreach ($this->file('files') as $index => $file) {
                    $declaredExtension = $file->getClientOriginalExtension();
                    $mimeType = $file->getMimeType();

                    // Protection contre les fichiers malveillants
                    if ($this->isSuspiciousMimeType($mimeType, $declaredExtension)) {
                        $validator->errors()->add(
                            "files.{$index}",
                            "Le fichier semble malveillant ou corrompu (extension/type MIME incohérent)."
                        );
                    }
                }
            }
        });
    }

    /**
     * Détecte les types MIME suspects
     *
     * @param string $mimeType
     * @param string $extension
     * @return bool
     */
    private function isSuspiciousMimeType(string $mimeType, string $extension): bool
    {
        // Fichiers exécutables interdits
        $dangerousMimeTypes = [
            'application/x-msdownload',
            'application/x-executable',
            'application/x-dosexec',
            'application/x-sh',
            'application/x-bat',
            'text/x-php',
            'text/x-perl',
            'text/x-python',
        ];

        if (in_array($mimeType, $dangerousMimeTypes)) {
            return true;
        }

        // Extensions dangereuses
        $dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'pl', 'py', 'rb', 'jar'];
        if (in_array(strtolower($extension), $dangerousExtensions)) {
            return true;
        }

        return false;
    }
}
