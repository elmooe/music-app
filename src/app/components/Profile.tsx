'use client';

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './Profile.module.css';

const Profile: React.FC = () => {
  const [friendName, setFriendName] = useState('');
  const [friends, setFriends] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchCachedData = async () => {
      try {
        const cachedFriends = await invoke<string[] | null>('get_cached_friends');
        if (cachedFriends && cachedFriends.length > 0) {
          setFriends(cachedFriends);
          console.log(`Loaded cached friends:`, cachedFriends);
        }
      } catch (error) {
        console.error('Error fetching cached data:', error);
      }
    };

    fetchCachedData();
  }, []);

  const handleAddFriend = async () => {
    try {
      await invoke('add_friend_command', { friendUsername: friendName });
      setMessage('User added as a friend!');
      console.log('Friend added!');
      setFriendName('');
      const updatedFriends = await invoke<string[] | null>('get_cached_friends');
      setFriends(updatedFriends || []);
    } catch (err) {
      setMessage('No user found with that username.');
      console.error('Error adding friend:', err);
    }
  };

  const handleRemoveFriend = async (friendToRemove: string) => {
    try {
      await invoke('remove_friend_command', { friendUsername: friendToRemove });
      console.log(`Friend '${friendToRemove}' removed!`);
      setFriends(friends.filter(friend => friend !== friendToRemove));
    } catch (err) {
      console.error(`Error removing friend '${friendToRemove}':`, err);
    }
  };

  return (
    <div className={styles.container}>
      <h1>Profile</h1>
      <div className={styles.layout}>
        <div className={styles.friendsList}>
          <h2>Friends</h2>
          <ul>
            {friends.map((friend, index) => (
              <li key={index}>
                {friend}
                <button
                  onClick={() => handleRemoveFriend(friend)}
                  className={styles.removeFriendButton}
                >
                ✖️
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.addFriendSection}>
          <h2>Add Friend</h2>
          <input
            type="text"
            placeholder="Enter your friend's username"
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
            className={styles.addFriendInput}
          />
          <button onClick={handleAddFriend} className={styles.addFriendButton}>
            Add Friend
          </button>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;