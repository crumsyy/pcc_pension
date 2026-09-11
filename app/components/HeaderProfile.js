'use client';

import React from 'react';

export default function HeaderProfile({ user, name, avatar, className = '' }) {
  const displayName = name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || 'Guest'));
  const profilePicture = avatar || user?.profilePicture;
  const initial = (displayName && displayName.length > 0) ? displayName.charAt(0).toUpperCase() : 'G';

  return (
    <span
      className={`guest-mobile-user-badge d-inline-flex align-items-center gap-2 ${className}`}
      title={displayName}
    >
      {profilePicture ? (
        <img
          src={profilePicture}
          alt="Avatar"
          className="rounded-circle border border-white flex-shrink-0"
          style={{ width: '24px', height: '24px', objectFit: 'cover' }}
        />
      ) : (
        <div
          className="profile-avatar-initial flex-shrink-0"
          style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}
        >
          {initial}
        </div>
      )}
      <span className="user-name header-profile-name">
        {displayName}
      </span>
    </span>
  );
}
