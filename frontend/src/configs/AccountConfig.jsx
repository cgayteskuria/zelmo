import { Tag } from "antd";
import api from '../services/api';


/**
 * Formatter pour le statut de l'écriture comptable
 */
export const formatStatus = (value) => {
    if (!value || value === '0000-00-00' || value === null) {
        return <Tag color='default' variant='outlined'>Brouillon</Tag>;       
    }
     return <Tag color='green' variant='outlined'>Validé</Tag>;    
};
