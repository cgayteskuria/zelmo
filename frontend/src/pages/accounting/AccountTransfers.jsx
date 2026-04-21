import { Button } from "antd";
import { PlusOutlined, EyeOutlined } from "@ant-design/icons";
import { ServerTable } from "../../components/table";
import PageContainer from "../../components/common/PageContainer";
import { useNavigate } from "react-router-dom";
import { accountTransfersApi } from "../../services/api";
import dayjs from "dayjs";

/**
 * Liste des transferts comptables effectués
 */
export default function AccountTransfers() {
    const navigate = useNavigate();

    const columns = [
        {
            title: "Date",
            dataIndex: "atr_created",
            key: "atr_created",
            width: 130,
            align: "center",
            sorter: true,
            render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '',
        },
        {
            title: "Effectué par",
            dataIndex: "author",
            key: "author",
        },
        {
            title: "Nb mouvements",
            dataIndex: "atr_moves_number",
            key: "atr_moves_number",
            width: 140,
            align: "center",
            sorter: true,
        },
        {
            title: "Période du",
            dataIndex: "atr_transfer_start",
            key: "atr_transfer_start",
            width: 120,
            align: "center",
            sorter: true,
            render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '',
        },
        {
            title: "au",
            dataIndex: "atr_transfer_end",
            key: "atr_transfer_end",
            width: 120,
            align: "center",
            sorter: true,
            render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '',
        },
        {
            title: "Actions",
            key: "actions",
            width: 90,
            align: "center",
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/account-transfers/${record.id}`)}
                >
                    Voir
                </Button>
            ),
        },
    ];

    return (
        <PageContainer
            title="Transferts comptables"
            actions={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/account-transfers/new')}
                    size="large"
                >
                    Nouveau transfert
                </Button>
            }
        >
            <ServerTable
                fetchFn={accountTransfersApi.list}
                columns={columns}
                rowKey="id"
            />
        </PageContainer>
    );
}
