'use client';

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import MusicPlayer from './components/SamplesAndPresets';
import Profile from './components/Profile';
import Library from './components/Library';
import Footer from './components/Footer';
import AddContent from './components/AddContent';
import styles from './page.module.css';
import Login from './components/Login';

export default function Home() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentPage, setCurrentPage] = useState<'home' | 'add' | 'profile' | 'library'>('home');

    const handleLoginSuccess = () => {
        setIsLoggedIn(true);
    };

    const renderContent = () => {
        if (!isLoggedIn) {
            return <Login onLoginSuccess={handleLoginSuccess}/>;
        }

        switch (currentPage) {
            case 'library':
                return <Library />;
            case 'add':
                return <AddContent />;

            case 'profile':
                return <Profile />;
            default:
                return <MusicPlayer />;
        }
    };

    return (
        <div className={styles.page}>
            {isLoggedIn && (
                <Sidebar
                    setPage={(page) => {
                        setCurrentPage(page as 'home' | 'add' | 'library' | 'profile');
                    }}
                />
            )}
            <main className={styles.main}>{renderContent()}</main>
            {isLoggedIn && <Footer />}
        </div>
    );
}