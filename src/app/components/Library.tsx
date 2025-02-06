import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import styles from './Library.module.css';

interface Song {
    title: string;
}

const Library: React.FC = () => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [directory, setDirectory] = useState<string | null>(null);

    useEffect(() => {
        const fetchCachedData = async () => {
            try {
                const cachedDir = await invoke<string | null>('get_directory_path');
                const cachedSongs = await invoke<Song[]>('get_cached_songs');

                if (cachedDir) {
                    setDirectory(cachedDir);
                    console.log(`Cached directory loaded: ${cachedDir}`);
                }

                if (cachedSongs.length > 0) {
                    setSongs(cachedSongs);
                    console.log(`Loaded cached songs:`, cachedSongs);
                }
            } catch (error) {
                console.error('Error fetching cached data:', error);
            }
        };

        fetchCachedData();
    }, []);

    const selectDirectory = async () => {
        try {
            const selectedDir = await open({
                directory: true,
                multiple: false,
            });

            if (!selectedDir) return;

            setDirectory(selectedDir as string);

            await invoke('set_directory', { path: selectedDir });
            console.log('Directory set:', selectedDir);

            const fetchedSongs = await invoke<Song[]>('get_cached_songs');
            setSongs(fetchedSongs);
        } catch (error) {
            console.error('Error selecting directory:', error);
        }
    };

    const handlePlaySong = async (song: Song) => {
        try {
            await invoke('play_song', { title: song.title });
            console.log(`Now playing: ${song.title}`);
        } catch (error) {
            console.error('Error playing song:', error);
        }
    };

    return (
        <div className={styles.container}>
            <h1>My Library</h1>
            <button onClick={selectDirectory} className={styles.selectButton}>
                Select Directory
            </button>
            {directory && <p>Selected Directory: {directory}</p>}
            <div className={styles.listBg}>
                <div className={styles.songList}>
                    <ul>
                        {songs.length > 0 ? (
                            songs.map((song, index) => (
                                <li
                                    key={index}
                                    onClick={() => handlePlaySong(song)}
                                    className={styles.songItem}
                                >
                                    {song.title}
                                </li>
                            ))
                        ) : (
                            <li>No files available.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Library;