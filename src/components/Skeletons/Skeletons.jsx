import React from 'react'

export function Shimmer({ className = '', style }) {
  return <div aria-hidden="true" className={`ui-skeleton ${className}`} style={style} />
}

export function AnimeCardSkeleton({ className = '' }) {
  return (
    <div className={`anime-card-skeleton ${className}`} aria-hidden="true">
      <Shimmer className="anime-card-skeleton-media" />
      <Shimmer className="anime-card-skeleton-title" />
      <Shimmer className="anime-card-skeleton-meta" />
    </div>
  )
}

export function WatchPageSkeleton() {
  return (
    <div className="watch-page-skeleton" role="status" aria-label="Loading video player">
      <Shimmer className="watch-page-skeleton-player" />
      <div className="watch-page-skeleton-controls">
        <Shimmer className="watch-page-skeleton-line watch-page-skeleton-line-wide" />
        <Shimmer className="watch-page-skeleton-line watch-page-skeleton-line-short" />
      </div>
      <div className="watch-page-skeleton-pills">
        <Shimmer className="watch-page-skeleton-pill" />
        <Shimmer className="watch-page-skeleton-pill" />
        <Shimmer className="watch-page-skeleton-pill" />
      </div>
      <div className="watch-page-skeleton-grid">
        <div>
          <Shimmer className="watch-page-skeleton-heading" />
          <Shimmer className="watch-page-skeleton-line" />
          <Shimmer className="watch-page-skeleton-line watch-page-skeleton-line-wide" />
          <Shimmer className="watch-page-skeleton-line watch-page-skeleton-line-medium" />
        </div>
        <div className="watch-page-skeleton-sidebar">
          <Shimmer className="watch-page-skeleton-sidebar-heading" />
          {Array.from({ length: 4 }, (_, i) => (
            <div className="watch-page-skeleton-episode" key={i}>
              <Shimmer className="watch-page-skeleton-thumb" />
              <div>
                <Shimmer className="watch-page-skeleton-episode-title" />
                <Shimmer className="watch-page-skeleton-episode-meta" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AnimeDetailSkeleton() {
  return (
    <div className="anime-detail-skeleton" role="status" aria-label="Loading anime details">
      <Shimmer className="anime-detail-skeleton-banner" />
      <div className="anime-detail-skeleton-content">
        <Shimmer className="anime-detail-skeleton-cover" />
        <div className="anime-detail-skeleton-info">
          <Shimmer className="anime-detail-skeleton-title" />
          <Shimmer className="anime-detail-skeleton-meta" />
          <Shimmer className="anime-detail-skeleton-description" />
          <Shimmer className="anime-detail-skeleton-description anime-detail-skeleton-description-short" />
          <div className="anime-detail-skeleton-actions">
            <Shimmer className="anime-detail-skeleton-button" />
            <Shimmer className="anime-detail-skeleton-button" />
          </div>
        </div>
      </div>
      <div className="anime-detail-skeleton-episodes">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="anime-detail-skeleton-episode" key={i}>
            <Shimmer className="anime-detail-skeleton-episode-thumb" />
            <Shimmer className="anime-detail-skeleton-episode-line" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageLoader({ label = 'Loading page' }) {
  return (
    <div className="page-loader" role="status" aria-label={label}>
      <span className="page-loader-ring" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
