import styles from './Footer.module.css';
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Song {
    title: string;
}

const Footer: React.FC = () => {
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [volume, setVolume] = useState<number>(100);

    const fetchCurrentSong = async () => {
        try {
            const title = await invoke<string | null>('get_current_song_playing');
            if (title) {
                setCurrentSong({ title });
            } else {
                setCurrentSong(null);
            }
        } catch (error) {
            console.error('Error fetching current song:', error);
        }
    };

    const handleVolumeChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(event.target.value, 10);
        const normalizedVolume = newVolume / 100;
        setVolume(newVolume);

        try {
            await invoke('set_volume', { vol: normalizedVolume });
            console.log(`Volume set to: ${newVolume * 100}`);
        } catch (error) {
            console.error('Error changing volume:', error);
        }
    };

    const pauseSong = async () => {
        try {
            await invoke('pause_song');
            setIsPaused(true);
            console.log('Song paused');
        } catch (error) {
            console.error('Error pausing song:', error);
        }
    };

    const unpauseSong = async () => {
        try {
            await invoke('unpause_song');
            setIsPaused(false);
            console.log('Song unpaused');
        } catch (error) {
            console.error('Error pausing song:', error);
        }
    };

    useEffect(() => {
        fetchCurrentSong();
        const interval = setInterval(fetchCurrentSong, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={styles.musicControls}>
            <p className={styles.nowPlaying}>
                {currentSong
                    ? `Now playing: ${currentSong.title}`
                    : 'No song is currently playing'}
            </p>
            <div className={styles.controls}>
                {!isPaused ? (
                    <button onClick={pauseSong}>⏸</button>
                ) : (
                    <button onClick={unpauseSong}>▶</button>
                )}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                />
            </div>
        </div>
    );
};

export default Footer;