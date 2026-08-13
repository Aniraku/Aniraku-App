import React, { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch, FaStar, FaCheck, FaFastForward } from 'react-icons/fa'
import { generateSlug } from '../../lib/slug'

const EPISODES_PER_PAGE = 50

const EpisodeRow = memo(function EpisodeRow({
  ep, num, isActive, animeId, animeTitle, watched, rated,
}) {
  const slug = generateSlug(animeTitle)
  return (
    <Link
      key={num}
      to={`/watch/${slug}-${animeId}-episode-${num}`}
      aria-current={isActive ? 'true' : 'false'}
      data-active={isActive ? 'true' : 'false'}
      onMouseEnter={(e) => {
        if (!isActive)
          e.currentTarget.style.background = 'rgba(226,232,240,0.05)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        textDecoration: 'none',
        color: 'var(--text-primary)',
        background: isActive
          ? 'rgba(99,102,241,0.12)'
          : 'transparent',
        border: isActive
          ? '1px solid rgba(99,102,241,0.35)'
          : '1px solid transparent',
        minHeight: 44,
        opacity: ep.filler && !isActive ? 0.72 : 1,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {ep.thumbnail ? (
          <img
            src={ep.thumbnail}
            alt={`Episode ${num}`}
            loading="lazy"
            style={{
              width: 80,
              height: 45,
              objectFit: 'cover',
              borderRadius: 6,
              flexShrink: 0,
              background: 'var(--bg-elevated)',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: 80,
              height: 45,
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {num}
          </div>
        )}
        {watched && (
          <span
            aria-label="Watched"
            title="Watched"
            style={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              width: 16,
              height: 16,
              borderRadius: 99,
              background: 'rgba(34,197,94,0.95)',
              color: '#052e16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              lineHeight: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <FaCheck size={9} />
          </span>
        )}
        {!!ep.filler && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              background: 'rgba(234,179,8,0.92)',
              color: '#0f172a',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.3,
              lineHeight: 1.5,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            FILLER
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {ep.title || `Episode ${num}`}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
          }}
        >
          EP {num}
          {!!ep.recap && (
            <span
              style={{
                background: 'rgba(99,102,241,0.15)',
                color: '#a5b4fc',
                padding: '1px 5px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              RECAP
            </span>
          )}
          {Number(rated) > 0 && (
            <span
              title={`You rated this episode ${rated}/10`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <FaStar size={8} />
              {rated}/10
            </span>
          )}
        </div>
      </div>
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: '#a5b4fc',
            flexShrink: 0,
          }}
        />
      )}
    </Link>
  )
})

const EpisodeSidebar = memo(function EpisodeSidebar({
  filteredEps,
  pagedEps,
  epPage,
  totalEpPages,
  epSearch,
  hideFillers,
  hiddenEpCount,
  episodeCount,
  epNumber,
  animeId,
  animeTitle,
  watchedEps,
  epRatings,
  onSearch,
  onPageChange,
  onToggleFillers,
  sidebarRef,
}) {
  const [jumpEp, setJumpEp] = useState('')

  const handleJump = (e) => {
    e.preventDefault()
    const num = parseInt(jumpEp, 10)
    if (!isNaN(num) && num >= 1 && num <= episodeCount) {
      const targetPage = Math.floor((num - 1) / EPISODES_PER_PAGE)
      onPageChange(targetPage)
      setJumpEp('')
    }
  }

  return (
    <aside
      ref={sidebarRef}
      className="watch-episodes"
      aria-label="Episode list"
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: 14,
        position: 'sticky',
        top: 16,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Episodes ({filteredEps.length}
          {hiddenEpCount > 0 && hideFillers ? ` of ${episodeCount}` : ''})
        </h3>
        {hiddenEpCount > 0 && (
          <button
            type="button"
            onClick={onToggleFillers}
            aria-pressed={hideFillers}
            title="Hide filler & recap episodes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: hideFillers
                ? 'rgba(99,102,241,0.18)'
                : 'var(--bg-elevated)',
              color: hideFillers ? '#a5b4fc' : 'var(--text-muted)',
              border: `1px solid ${
                hideFillers ? 'rgba(99,102,241,0.45)' : 'var(--border)'
              }`,
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 30,
              whiteSpace: 'nowrap',
            }}
          >
            {hideFillers ? 'Showing canon' : 'Hide fillers'}
            {hideFillers && <span>✓</span>}
          </button>
        )}
      </div>

      {episodeCount > EPISODES_PER_PAGE && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FaSearch
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                }}
                aria-hidden="true"
              />
              <input
                type="text"
                value={epSearch}
                onChange={onSearch}
                placeholder="Search episodes…"
                aria-label="Search episodes"
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px 8px 30px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  boxSizing: 'border-box',
                  outline: 'none',
                  minHeight: 36,
                }}
              />
            </div>
            <form onSubmit={handleJump} style={{ display: 'flex', gap: 4, width: 90 }}>
              <input
                type="number"
                min="1"
                max={episodeCount}
                value={jumpEp}
                onChange={(e) => setJumpEp(e.target.value)}
                placeholder="Jump#"
                aria-label="Jump to episode number"
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 6px',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  boxSizing: 'border-box',
                  outline: 'none',
                  minHeight: 36,
                  textAlign: 'center',
                }}
              />
            </form>
          </div>
          {episodeCount > 100 && (
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }} aria-label="Episode range selector">
              {Array.from({ length: Math.ceil(episodeCount / 100) }, (_, i) => {
                const start = i * 100 + 1
                const end = Math.min(episodeCount, (i + 1) * 100)
                const isCurrentRange = epPage >= i * 2 && epPage < (i + 1) * 2
                return (
                  <button
                    key={start}
                    type="button"
                    onClick={() => onPageChange(i * 2)}
                    style={{
                      background: isCurrentRange ? 'rgba(99,102,241,0.2)' : 'var(--bg-elevated)',
                      border: `1px solid ${isCurrentRange ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                      color: isCurrentRange ? '#a5b4fc' : 'var(--text-muted)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {start}–{end}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {totalEpPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 11,
          }}
        >
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, epPage - 1))}
            disabled={epPage === 0}
            aria-label="Previous page"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: epPage === 0 ? 'default' : 'pointer',
              opacity: epPage === 0 ? 0.4 : 1,
              minHeight: 32,
            }}
          >
            ←
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            Page {epPage + 1} of {totalEpPages} ({episodeCount} eps)
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalEpPages - 1, epPage + 1))}
            disabled={epPage >= totalEpPages - 1}
            aria-label="Next page"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              color: 'var(--text-secondary)',
              fontSize: 11,
              cursor: epPage >= totalEpPages - 1 ? 'default' : 'pointer',
              opacity: epPage >= totalEpPages - 1 ? 0.4 : 1,
              minHeight: 32,
            }}
          >
            →
          </button>
        </div>
      )}

      <div
        className="watch-ep-list"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {pagedEps.map((ep, i) => {
          // Canonical episode numbering: derive number from position in the list
          // to permanently fix the "10x" multiplication bug from providers.
          const absoluteIndex = epPage * EPISODES_PER_PAGE + i
          const num = absoluteIndex + 1
          return (
            <EpisodeRow
              key={num}
              ep={ep}
              num={num}
              isActive={num === epNumber}
              animeId={animeId}
              animeTitle={animeTitle}
              watched={watchedEps.has(num)}
              rated={epRatings[num] || 0}
            />
          )
        })}
        {pagedEps.length === 0 && (
          <div
            style={{
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: 16,
              fontSize: 12,
            }}
          >
            {epSearch
              ? 'No episodes match your search'
              : 'No episodes listed'}
          </div>
        )}
      </div>
    </aside>
  )
})

export default EpisodeSidebar
