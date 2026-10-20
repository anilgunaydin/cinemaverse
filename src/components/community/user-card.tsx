"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { FollowButton, BlockButton, MuteButton } from "@/components/community/social-buttons";
import { ReportButton } from "@/components/community/report-button";

export type UserCardProps = {
  userId?: string;
  id: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  viewerId?: string | null;
  showActions?: boolean;
};

export function UserCard({
  userId,
  id,
  displayName,
  bio,
  avatarUrl,
  viewerId,
  showActions = true,
}: UserCardProps) {
  const resolvedUserId = userId ?? id;
  const [relationship, setRelationship] = useState<{
    isFollowing: boolean;
    isFollowedBy: boolean;
    isBlocked: boolean;
    isBlocking: boolean;
    isMuted: boolean;
    followersCount: number;
    followingCount: number;
  } | null>(null);

  useEffect(() => {
    if (!viewerId || viewerId === resolvedUserId) return;
    async function load() {
      const response = await fetch(`/api/users/${encodeURIComponent(resolvedUserId)}/relationship`);
      if (response.ok) {
        const data = (await response.json()) as { relationship: typeof relationship };
        setRelationship(data.relationship);
      }
    }
    load();
  }, [viewerId, resolvedUserId]);

  if (viewerId && relationship?.isBlocking) {
    return (
      <div className="surface p-4 text-center text-mist-500">
        Bu kullanıcı sizi engellediği için profili görüntülenemiyor.
      </div>
    );
  }

  const isOwnProfile = viewerId === resolvedUserId;

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${displayName} avatar`}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-gold-500/20 to-ink-800 flex items-center justify-center">
              <span className="font-display text-3xl font-bold text-gold-300">
                {displayName.slice(0, 1).toLocaleUpperCase("tr")}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <Link href={`/users/${resolvedUserId}`} className="font-display text-xl font-semibold text-mist-100 hover:text-gold-300">
            {displayName}
          </Link>
          {bio ? (
            <p className="mt-1 text-sm text-mist-400 line-clamp-2">{bio}</p>
          ) : null}

          {relationship && !isOwnProfile ? (
            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-mist-500">
              <span>
                <span className="font-semibold text-mist-300">{relationship.followersCount}</span> takipçi
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-mist-300">{relationship.followingCount}</span> takip ediliyor
              </span>
            </div>
          ) : null}
        </div>

        {showActions && viewerId && !isOwnProfile && relationship ? (
          <div className="flex flex-col gap-2 shrink-0">
            <FollowButton
              targetUserId={resolvedUserId}
              initialFollowing={relationship.isFollowing}
              initialFollowersCount={relationship.followersCount}
              onUpdate={(data) => setRelationship((prev) => prev ? { ...prev, ...data } : null)}
            />
            <div className="flex gap-1">
              <BlockButton
                targetUserId={resolvedUserId}
                initialBlocked={relationship.isBlocking}
                onUpdate={(blocked) =>
                  setRelationship((prev) => prev ? { ...prev, isBlocking: blocked } : null)
                }
              />
              <MuteButton
                targetUserId={resolvedUserId}
                initialMuted={relationship.isMuted}
                onUpdate={(muted) =>
                  setRelationship((prev) => prev ? { ...prev, isMuted: muted } : null)
                }
              />
              <ReportButton
                targetType="user"
                targetId={resolvedUserId}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UserList({
  users: userList,
  viewerId,
  title,
  emptyMessage = "Kullanıcı bulunamadı.",
}: {
  users: Array<{ id: string; displayName: string; bio?: string | null; avatarUrl?: string | null }>;
  viewerId: string | null;
  title?: string;
  emptyMessage?: string;
}) {
  if (userList.length === 0) {
    return (
      <div className="surface text-center py-8">
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <section className="surface p-4 sm:p-5">
      {title && <h2 className="section-title">{title}</h2>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {userList.map((user) => (
          <UserCard key={user.id} {...user} viewerId={viewerId} showActions={false} />
        ))}
      </div>
    </section>
  );
}