import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FaRegThumbsUp, FaThumbsUp, FaTrash, FaReply } from 'react-icons/fa'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import styled from 'styled-components'

const cleanContent = (raw) => {
  const out = []
  for (const ch of raw) {
    const code = ch.codePointAt(0)
    if (code >= 0xD800 && code <= 0xDFFF) continue
    out.push(ch)
    if (out.length >= 2000) break
  }
  return out.join('')
}

const Wrapper = styled.section`
  margin-top: 40px;
`

const Title = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
`

const Subtitle = styled.p`
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
`

const Composer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  background: var(--bg-card);
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--border);
  position: relative;
`

/* Removed active GIF picker styles: new GIF composition is intentionally disabled while public no-auth alternatives are evaluated. */
const LegacyGifFallback = styled.span`
  display: inline-block;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
`

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-elevated);
  flex-shrink: 0;
`

const InitialAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
  text-transform: uppercase;
`

const ErrorMsg = styled.p`
  color: #ef4444;
  font-size: 13px;
  margin: 0;
`

const Textarea = styled.textarea`
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  padding: 0;
  resize: none;
  min-height: 40px;
  outline: none;
  box-sizing: border-box;
`

const PostBtn = styled.button`
  padding: 8px 20px;
  background: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  cursor: ${p => p.$disabled ? 'wait' : 'pointer'};
  opacity: ${p => p.$disabled ? 0.6 : 1};
  transition: all 0.2s;
  &:hover { transform: translateY(-1px); }
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`

const Item = styled.div`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
`

const ItemReply = styled(Item)`
  margin-left: 46px;
  @media (max-width: 480px) { margin-left: 20px; }
`

const ItemHead = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`

const ItemName = styled(Link)`
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`

const ItemTime = styled.span`
  color: var(--text-muted);
  font-size: 12px;
`

const ItemBody = styled.div`
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
`

const ItemGif = styled.img`
  max-width: 300px;
  max-height: 200px;
  border-radius: 8px;
  margin-top: 8px;
  display: block;
  @media (max-width: 480px) { max-width: 100%; }
`

const ItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`

const Action = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: ${p => p.$active ? 'var(--accent)' : 'var(--text-muted)'};
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  &:hover { color: var(--accent); }
`

const Empty = styled.p`
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
`

const GuestBox = styled.div`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8;
  a { color: var(--accent); text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
`

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

const nameOf = (profiles, uid) => {
  const p = profiles[uid]
  return p?.display_name || p?.username || 'Anonymous'
}

const avatarOf = (profiles, uid) => profiles[uid]?.avatar_url || null

const AvatarBlock = ({ url, name }) => url
  ? <Avatar src={url} alt="" />
  : <InitialAvatar>{(name || 'A').charAt(0)}</InitialAvatar>

const renderItem = (c, reply, {
  profiles, likedIds, replyTo, replyText, busy, user,
  toggleLike, remove, submitReply, setReplyTo, setReplyText, setPostError
}) => {
  const Mine = reply ? ItemReply : Item
  const contentParts = c.content.split('||GIF:').map(s => s.trim())
  const textContent = contentParts[0]
  const gifUrl = contentParts[1]

  return (
    <Mine key={c.id}>
      <ItemHead>
        <AvatarBlock url={avatarOf(profiles, c.user_id)} name={nameOf(profiles, c.user_id)} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <ItemName to="/profile">{nameOf(profiles, c.user_id)}</ItemName>
          <ItemTime>{timeAgo(c.created_at)}</ItemTime>
        </div>
      </ItemHead>
      <ItemBody>
        {textContent && <p style={{ margin: 0 }}>{textContent}</p>}
        {gifUrl && <ItemGif src={gifUrl} alt="anime reaction" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.nextElementSibling?.removeAttribute('hidden') }} />}
        {gifUrl && <LegacyGifFallback hidden>Legacy GIF unavailable.</LegacyGifFallback>}
      </ItemBody>
      <ItemActions>
        <Action $active={likedIds.has(c.id)} onClick={() => toggleLike(c.id)} title="Like">
          {likedIds.has(c.id) ? <FaThumbsUp size={13} /> : <FaRegThumbsUp size={13} />}
          {c.likes || 0}
        </Action>
        <Action onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); setPostError('') }}>
          <FaReply size={12} /> Reply
        </Action>
        {user && user.id === c.user_id && (
          <Action onClick={() => remove(c.id)} title="Delete" style={{ marginLeft: 'auto' }}>
            <FaTrash size={12} /> Delete
          </Action>
        )}
      </ItemActions>
      {replyTo === c.id && (
        <Composer style={{ marginTop: 12, marginBottom: 0, padding: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Textarea
                placeholder={`Reply to ${nameOf(profiles, c.user_id)}…`}
                value={replyText}
                onChange={e => { setReplyText(e.target.value); setPostError('') }}
                rows={1}
              />
              <PostBtn $disabled={busy || !replyText.trim()} onClick={() => submitReply(c.id)}>Post</PostBtn>
            </div>
          </div>
        </Composer>
      )}
    </Mine>
  )
}

const Comments = ({ animeId, episodeNumber, label }) => {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [profiles, setProfiles] = useState({})
  const [myProfile, setMyProfile] = useState(null)
  const [likedIds, setLikedIds] = useState(new Set())
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const query = supabase
        .from('comments')
        .select('*')
        .eq('anime_id', animeId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (episodeNumber) query.eq('episode_number', episodeNumber)
      const { data, error } = await query
      if (cancelled) return
      if (error) { console.error('Comments load:', error); setLoading(false); return }
      const rows = data || []
      setComments(rows)

      const ids = [...new Set(rows.map(c => c.user_id).filter(Boolean))]
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', ids)
        if (cancelled) return
        if (profs) {
          setProfiles(Object.fromEntries(profs.map(p => [p.id, p])))
        }
      }

      if (user) {
        const { data: me } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (me) setMyProfile(me)
        const { data: likes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
        if (cancelled) return
        if (likes) setLikedIds(new Set(likes.map(l => l.comment_id)))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [animeId, episodeNumber, user])

  const [postError, setPostError] = useState('')

  const submit = async (e) => {
    if (e) e.preventDefault()
    const text = content.trim()
    if (!text || !user || busy) return
    setBusy(true)
    const finalContent = text
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        anime_id: animeId,
        episode_number: episodeNumber || null,
        content: cleanContent(finalContent),
        parent_id: null,
      })
      .select()
      .single()
    setBusy(false)
    if (error) { console.error('Comment post:', error); setPostError('Could not post your comment. Please try again.'); return }
    setPostError('')
    setComments(prev => [...prev, data])
    setProfiles(prev => ({
      ...prev,
      [user.id]: prev[user.id] || {
        username: myProfile?.username || user.user_metadata?.username,
        display_name: myProfile?.display_name || null,
        avatar_url: myProfile?.avatar_url || null,
      },
    }))
    setContent('')
  }

  const submitReply = async (parentId) => {
    const text = replyText.trim()
    if (!text || !user || busy) return
    setBusy(true)
    const finalContent = text
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        anime_id: animeId,
        episode_number: episodeNumber || null,
        content: cleanContent(finalContent),
        parent_id: parentId,
      })
      .select()
      .single()
    setBusy(false)
    if (error) { console.error('Reply post:', error); setPostError('Could not post your reply. Please try again.'); return }
    setPostError('')
    setComments(prev => [...prev, data])
    setProfiles(prev => ({
      ...prev,
      [user.id]: prev[user.id] || {
        username: myProfile?.username || user.user_metadata?.username,
        display_name: myProfile?.display_name || null,
        avatar_url: myProfile?.avatar_url || null,
      },
    }))
    setReplyTo(null)
    setReplyText('')
  }

  const toggleLike = async (id) => {
    if (!user) return
    const { data, error } = await supabase.rpc('toggle_comment_like', { p_comment_id: id })
    if (error) { console.error('Like toggle:', error); return }
    setComments(prev => prev.map(c => c.id === id ? { ...c, likes: data } : c))
    setLikedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const remove = async (id) => {
    if (!user) return
    const { error } = await supabase.from('comments').delete().or(`id.eq.${id},parent_id.eq.${id}`)
    if (error) { console.error('Comment delete:', error); return }
    setComments(prev => prev.filter(c => c.id !== id && c.parent_id !== id))
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesOf = (id) => comments.filter(c => c.parent_id === id)

  const itemProps = {
    profiles,
    likedIds,
    replyTo,
    replyText,
    busy,
    user,
    toggleLike,
    remove,
    submitReply,
    setReplyTo,
    setReplyText,
    setPostError
  }

  return (
    <Wrapper>
      <Title>Comments ({comments.length})</Title>
      {label && <Subtitle>{label}</Subtitle>}

      {user ? (
        <Composer>
          <AvatarBlock
            url={myProfile?.avatar_url}
            name={myProfile?.display_name || myProfile?.username || user.email || 'You'}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Textarea
                placeholder="Share your thoughts…"
                value={content}
                onChange={e => { setContent(e.target.value); setPostError('') }}
                maxLength={2000}
              />
              <PostBtn type="button" $disabled={busy || !content.trim()} onClick={() => submit()}>Post</PostBtn>
            </div>
            {postError && <ErrorMsg style={{ marginTop: 8 }}>{postError}</ErrorMsg>}
          </div>
        </Composer>
      ) : (
        <GuestBox>
          <Link to="/login">Log in</Link> or <Link to="/signup">create an account</Link> to join the discussion.
        </GuestBox>
      )}

      {loading ? (
        <Empty>Loading comments…</Empty>
      ) : topLevel.length === 0 ? (
        <Empty>No comments yet. Be the first to share your thoughts!</Empty>
      ) : (
        <List>
          {topLevel.map(c => (
            <React.Fragment key={c.id}>
              {renderItem(c, false, itemProps)}
              {repliesOf(c.id).map(r => renderItem(r, true, itemProps))}
            </React.Fragment>
          ))}
        </List>
      )}
    </Wrapper>
  )
}

export default Comments
