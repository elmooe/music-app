'use client';

import React from 'react';
import { FaUser, FaPlus, FaMusic, FaHome } from 'react-icons/fa';
import styles from "./Sidebar.module.css";

interface SidebarProps {
    setPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setPage }) => {
    return (
        <div className={styles.sidebar}>
            <button onClick={() => setPage('profile')} title="Profile">
                <FaUser />
            </button>
            <button onClick={() => setPage('add')} title="Add Content">
                <FaPlus />
            </button>
            <button onClick={() => setPage('library')} title="My Library">
                <FaMusic />
            </button>
            <button onClick={() => setPage('home')} title="Home">
                <FaHome />
            </button>
        </div>
    );
};

export default Sidebar;
