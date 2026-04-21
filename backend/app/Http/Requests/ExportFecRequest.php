<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExportFecRequest extends FormRequest
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
            'startDate' => [
                'required',
                'date_format:Y-m-d',
                'before_or_equal:endDate'
            ],
            'endDate' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:startDate'
            ],
            'acc_code_start' => [
                'nullable',
                'string',
                'max:20'
            ],
            'acc_code_end' => [
                'nullable',
                'string',
                'max:20'
            ],
            'ajl_id' => [
                'nullable',
                'integer',
                'exists:account_journal_ajl,ajl_id'
            ],
            'format' => [
                'required',
                'in:FEC'
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
            'startDate.required' => 'La date de début est obligatoire',
            'startDate.date_format' => 'La date de début doit être au format AAAA-MM-JJ',
            'startDate.before_or_equal' => 'La date de début doit être antérieure ou égale à la date de fin',
            'endDate.required' => 'La date de fin est obligatoire',
            'endDate.date_format' => 'La date de fin doit être au format AAAA-MM-JJ',
            'endDate.after_or_equal' => 'La date de fin doit être postérieure ou égale à la date de début',
            'acc_code_start.max' => 'Le code compte de début ne doit pas dépasser 20 caractères',
            'acc_code_end.max' => 'Le code compte de fin ne doit pas dépasser 20 caractères',
            'ajl_id.exists' => 'Le journal sélectionné n\'existe pas',
            'format.required' => 'Le format est obligatoire',
            'format.in' => 'Le format doit être FEC'
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
            'startDate' => 'date de début',
            'endDate' => 'date de fin',
            'acc_code_start' => 'code compte de début',
            'acc_code_end' => 'code compte de fin',
            'ajl_id' => 'journal',
            'format' => 'format d\'export'
        ];
    }
}
