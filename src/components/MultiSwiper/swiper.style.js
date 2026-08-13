import styled from 'styled-components'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Link } from 'react-router-dom'

export const S = {}
S.SwiperContainer = styled.div`
  padding-right: 60px;
  padding-left: 0;
  position: relative;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  z-index: 1;

  @media screen and (max-width: 768px) {
    padding-right: 0;
  }
`

S.Swiper = styled(Swiper)`
  width: 100%;
  height: 100%;
`

S.SwiperSlide = styled(SwiperSlide)`
  text-align: center;
  font-size: 18px;
`

S.Item = styled.div`
  width: 100%;
  height: auto;
  padding-bottom: 115%;
  position: relative;
  display: inline-block;
  overflow: hidden;

  @media screen and (max-width: 575px) {
    padding-bottom: 150%;
  }
`
S.Number = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  width: 40px;
  height: 50px;
  text-align: center;
  font-weight: 600;
  cursor: default;
  background: rgba(42, 44, 49, 0.85);
  border-radius: 0 0 6px 0;
  z-index: 2;

  @media screen and (max-width: 575px) {
    width: 40px;
    height: 30px;
    background: #fff;
    z-index: 9;
  }
`
S.SpanNum = styled.span`
  position: absolute;
  bottom: 0;
  font-size: 24px;
  line-height: 1em;
  text-align: center;
  color: var(--accent);
  z-index: 9;
  left: 0;
  right: 0;

  @media screen and (max-width: 575px) {
    color: #111;
    font-size: 18px;
    line-height: 30px;
    transform: none;
    text-align: center;
    color: #111;
  }
`
S.ItemName = styled.div`
  width: 100px;
  text-align: left;
  height: 40px;
  transform: rotate(-90deg);
  position: absolute;
  bottom: 100px;
  width: 150px;
  line-height: 40px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  left: -55px;
  font-size: 14px;
  font-weight: 400;
  color: #fff;
`

S.LinkImg = styled(Link)`
  display: block;
  position: absolute;
  width: auto;
  left: 40px;
  right: 0;
  top: 0;
  bottom: 0;
  padding-bottom: 0;
  height: auto;
  margin-bottom: 0;
  border-radius: 0 6px 6px 0;
  overflow: hidden;

  @media screen and (max-width: 575px) {
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 6px;
  }
`

S.SwiperImg = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`
S.NavBtn = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 40px;

  @media screen and (max-width: 768px) {
    display: none;
  }
`
