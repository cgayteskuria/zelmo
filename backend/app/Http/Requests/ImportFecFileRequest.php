<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportFecFileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:txt,text/plain',
                'max:20480', // 20 MB en kilobytes
            ],
            'format' => [
                'required',
                'in:FEC,CIEL'
            ]
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Le fichier est obligatoire',
            'file.file' => 'Le fichier envoyé n\'est pas valide',
            'file.mimes' => 'Le fichier doit être au format .txt (text/plain)',
            'file.max' => 'Le fichier ne doit pas dépasser 20 MB',
            'format.required' => 'Le format est obligatoire',
            'format.in' => 'Le format doit être FEC ou CIEL'
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'file' => 'fichier',
            'format' => 'format d\'import'
        ];
    }
}
