import { Button } from "antd";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import CanAccess from "../common/CanAccess";

/**
 * Composant réutilisable pour créer une colonne d'actions avec un bouton d'édition
 *
 * @param {string} permission - La permission requise pour afficher le bouton (ex: "users.edit")
 * @param {function} onEdit - Callback appelé lors du clic sur le bouton d'édition (reçoit l'objet row)
 * @param {number} width - Largeur de la colonne (par défaut: 100)
 * @param {string} label - Texte du bouton (par défaut: "Éditer")
 * @param {string} mode - "table" (utilise render pour Ant Design Table)
 * @returns {object} Configuration de la colonne pour Ant Design Table
 */
const ACTION_CONFIG = {
    edit: {
        icon: <EditOutlined />,
        label: "",
    },
    view: {
        icon: <EyeOutlined />,
        label: "",
    },
    // demain tu ajoutes ici :
    // delete: { icon: <DeleteOutlined />, label: "Supprimer" }
};

/**
 * Ordre de priorité des actions (du plus permissif au moins permissif)
 */
const ACTION_PRIORITY = ["edit", "view"];

export function createEditActionColumn({
    permission,
    permissionRoot,
    actionTypes = ["edit", "view"],
    onEdit,
    width = 50,
    type = "edit",
    label,
    header = " ",
    mode = "table",
}) {
    const action = ACTION_CONFIG[type] || ACTION_CONFIG.edit;

    const renderButton = (row) => (
        <CanAccess permission={permission}>
            <Button
                type="link"
                size="small"
                icon={action.icon}
                onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                }}
            >
                {label ?? action.label}
            </Button>
        </CanAccess>
    );

    // Mode Ant Design Table
    if (mode === "table") {
        return {
            key: "actions",
            title: header,
            width,
            fixed: "right",
            sortable: false,
            render: (_, record) => renderButton(record),
        };
    }
   
    return {
        id: "actions",
        header,
        sort: false,
        filterable: false,
        width,
        formatter: ({ row }) => renderButton(row),
    };
}

export default createEditActionColumn;
