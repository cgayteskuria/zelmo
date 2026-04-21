import { useRef, useCallback } from "react";

// TinyMCE core
import "tinymce/tinymce";
import "tinymce/models/dom/model";
import "tinymce/themes/silver/theme";
import "tinymce/icons/default/icons";

// TinyMCE plugins
import "tinymce/plugins/table";
import "tinymce/plugins/code";
import "tinymce/plugins/lists";
import "tinymce/plugins/advlist";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/preview";
import "tinymce/plugins/autolink";
import "tinymce/plugins/wordcount";

// TinyMCE skin (UI)
import "tinymce/skins/ui/oxide/skin.min.css";

// TinyMCE content CSS (for the iframe) — imported as raw strings
import contentCss from "tinymce/skins/content/default/content.min.css?raw";
import contentUiCss from "tinymce/skins/ui/oxide/content.min.css?raw";

// Langue FR — doit être importée APRÈS tinymce/tinymce
import "./tinymce-fr_FR";

import { Editor } from "@tinymce/tinymce-react";

/**
 * RichTextEditor — Wrapper TinyMCE self-hosted (GPL-2.0)
 *
 * Compatible Ant Design Form (value/onChange).
 * Fonctionnalités : tableaux avancés, édition du code source HTML,
 * mise en forme riche, images, liens, etc.
 *
 * Props :
 *   value       — contenu HTML (contrôlé par le formulaire)
 *   onChange    — callback(htmlString) quand le contenu change
 *   placeholder — texte affiché quand l'éditeur est vide
 *   height      — hauteur en pixels (défaut 350)
 */
export default function RichTextEditor({
    value,
    onChange,
    placeholder,
    height = 350,
}) {
    const editorRef = useRef(null);

    const handleEditorChange = useCallback(
        (content) => {
            onChange?.(content);
        },
        [onChange]
    );

    return (
        <Editor
            onInit={(_evt, editor) => {
                editorRef.current = editor;
            }}
            value={value || ""}
            onEditorChange={handleEditorChange}
            init={{
                license_key: 'gpl',
                // --- Apparence ---
                skin: false,
                content_css: false,
                content_style: [contentCss, contentUiCss].join("\n"),
                height,
                min_height: 250,
                resize: true,
                placeholder: placeholder || "Saisir le contenu...",
                branding: false,
                promotion: false,
                statusbar: false,
                menubar: false,
                //menubar: "file edit insert format table",

                // --- Plugins ---
                plugins:
                    "table code lists advlist link image searchreplace fullscreen visualblocks preview autolink wordcount",

                // --- Toolbar ---
                toolbar: [
                    "undo redo | bold italic underline strikethrough | forecolor backcolor",
                    "alignleft aligncenter alignright alignjustify |  blocks fontfamily fontsize | bullist numlist | table | link image | searchreplace | code fullscreen",
                ].join(" | "),

                // --- Table avancé ---
                table_toolbar:
                    "tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tablecellprops tablerowprops",
                table_appearance_options: true,
                table_advtab: true,
                table_cell_advtab: true,
                table_row_advtab: true,
                table_resize_bars: true,
                table_column_resizing: "resizetable",
                table_default_styles: {
                    width: "100%",
                    borderCollapse: "collapse",
                },
                table_default_attributes: {
                    border: "1",
                },

                // --- Formats de blocs ---
                block_formats:
                    "Paragraphe=p; Titre 1=h1; Titre 2=h2; Titre 3=h3; Titre 4=h4; Citation=blockquote; Préformaté=pre",

                // --- Lien ---
                link_default_target: "_blank",
                link_assume_external_targets: true,

                // --- Divers ---
                browser_spellcheck: true,
                contextmenu: "link table",
                elementpath: true,
                entity_encoding: "raw",
                convert_urls: false,
                paste_data_images: true,

                // --- Langue FR ---
                language: "fr_FR",
            }}
        />
    );
}
