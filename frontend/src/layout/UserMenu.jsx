import React from 'react';
import { Dropdown, Avatar } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logoutApi } from '../services/api';
import { clearAllCache } from '../hooks/useMenu.jsx';
import './layout.css';

const getInitials = (user) => {
    const first = user?.firstname?.[0] ?? user?.name?.[0] ?? '';
    const last  = user?.lastname?.[0] ?? '';
    return (first + last).toUpperCase().slice(0, 2) || '?';
};

const UserMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try { await logoutApi(); } catch { /* ignore */ }
        clearAllCache();
        logout();
        navigate('/login');
    };

    const items = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Mon profil',
            onClick: () => navigate('/my-profile'),
        },
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Se déconnecter',
            onClick: handleLogout,
            danger: true,
        },
    ];

    const initials = getInitials(user);
    const fullName = user ? `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() || user.login : 'Mon compte';

    return (
        <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <button className="avatar-google" title={fullName}>
                {initials}
            </button>
        </Dropdown>
    );
};

export default UserMenu;
