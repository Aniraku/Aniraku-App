import { Link } from "react-router-dom";
import styled from "styled-components";
import { Swiper, SwiperSlide } from "swiper/react";

export const H = {};

H.Swiper = styled(Swiper)`
  position: relative;
  display: flex;
  width: 100%;
  height: 420px;
  overflow: hidden;
  z-index: 1;

  @media screen and (min-width: 769px) {
    height: 480px;
  }
  @media screen and (min-width: 1200px) {
    height: 520px;
  }
`;

H.Slides = styled(SwiperSlide)``;

H.ImgContainer = styled.div`
  &::before {
    content: "";
    z-index: 1;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg);
    background: -moz-linear-gradient(
      90deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0.6) 40%,
      rgba(var(--bg-rgb, 14,14,17), 0) 60%,
      rgba(var(--bg-rgb, 14,14,17), 0) 80%,
      var(--bg) 100%
    );
    background: -webkit-linear-gradient(
      90deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0.6) 40%,
      rgba(var(--bg-rgb, 14,14,17), 0) 60%,
      rgba(var(--bg-rgb, 14,14,17), 0) 80%,
      var(--bg) 100%
    );
    background: linear-gradient(
      90deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0.6) 40%,
      rgba(var(--bg-rgb, 14,14,17), 0) 60%,
      rgba(var(--bg-rgb, 14,14,17), 0) 80%,
      var(--bg) 100%
    );
  }

  &::after {
    content: "";
    z-index: 1;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: -1px;
    background: var(--bg);
    background: -moz-linear-gradient(
      0deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0) 50%,
      var(--bg) 100%
    );
    background: -webkit-linear-gradient(
      0deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0) 50%,
      var(--bg) 100%
    );
    background: linear-gradient(
      0deg,
      var(--bg) 0,
      rgba(var(--bg-rgb, 14,14,17), 0) 50%,
      var(--bg) 100%
    );
  }
  @media screen and (max-width: 768px) {
    &::after {
      background: var(--bg);
      background: -moz-linear-gradient(
        0deg,
        var(--bg) 0,
        rgba(var(--bg-rgb, 14,14,17), 0) 82%
      );
      background: -webkit-linear-gradient(
        0deg,
        var(--bg) 0,
        rgba(var(--bg-rgb, 14,14,17), 0) 82%
      );
      background: linear-gradient(0deg, var(--bg) 0, rgba(var(--bg-rgb, 14,14,17), 0) 82%);
    }
    &::before {
      content: "";
      opacity: 0;
    }
  }
`;

H.Img = styled.img`
  width: 100%;
  height: 100%;
  position: absolute;
  object-fit: cover;
  @media screen and (max-width: 768px) {
    opacity: 0.5;
  }
`;
H.Content = styled.div`
  z-index: 1;
  width: 600px;
  height: 100%;
  position: absolute;
  display: flex;
  justify-content: flex-end;
  flex-direction: column;
  color: var(--accent);
  left: 2em;
  bottom: 0 !important;
  padding-bottom: 3em;
  overflow: hidden;

  @media screen and (max-width: 1200px) {
    width: 50%;
  }
  @media screen and (max-width: 768px) {
    width: 100%;
    padding: 0 16px 24px;
    left: 0;
  }
`;
H.Rank = styled.div`
  color: var(--accent);
  font-size: 14px;
  font-family: var(--font-body);
  font-weight: bolder;
  text-transform: uppercase;
  margin-bottom: 4px;
  @media screen and (max-width: 1200px) {
    font-size: 11px;
  }
  @media screen and (max-width: 480px) {
    font-size: 10px;
  }
`;
H.Title = styled.h1`
  font-family: var(--font-body);
  color: #fff;
  letter-spacing: 2px;
  margin-bottom: 20px;
  font-size: 50px;

  @media screen and (max-width: 1200px) {
    font-size: 30px;
    line-height: 1.1em;
    -webkit-line-clamp: 2;
  }
  @media screen and (max-width: 768px) {
    font-size: 22px;
    line-height: 1.15em;
    -webkit-line-clamp: 2;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }
  @media screen and (max-width: 480px) {
    font-size: 20px;
    margin-bottom: 4px;
  }
`;
H.Icons = styled.div`
  display: flex;
  gap: 1em;
  font-size: 14px;
  align-items: center;

  @media screen and (max-width: 768px) {
    display: none;
  }
`;
H.Icon = styled.p`
  display: flex;
  align-items: center;
  gap: 0.3em;
  color: #fff;
`;
H.IconSpan = styled.span`
  display: inline-block;
  padding: 3px 4px;
  background: var(--accent);
  color: #111;
  border-radius: 5px;
  line-height: 1em;
  font-weight: 600;
  font-size: 12px;
`;
H.Description = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-family: var(--font-body);
  color: #fff;
  font-size: 16px;
  margin: 2em 0;

  @media screen and (max-width: 1299px) {
    line-height: 1.1em;
    -webkit-line-clamp: 2;
  }
  @media screen and (max-width: 768px) {
    display: none;
  }
`;
H.WatchBtn = styled.div`
  display: flex;
  align-items: center;
  gap: 1em;

  @media screen and (max-width: 320px) {
    flex-wrap: wrap;
  }
`;
H.WatchLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.7rem 1em;
  background-color: var(--accent);
  color: #111;
  font-size: 18px;
  border-radius: 30px;
  font-family: var(--font-body);
  @media screen and (max-width: 1200px) {
    font-size: 16px;
  }
  @media screen and (max-width: 480px) {
    font-size: 12px;
    padding-inline: 1.2rem;
  }
`;
H.DetailLink = styled(Link)`
  display: flex;
  align-items: center;
  padding: 0.7rem 1em;
  background-color: var(--bg-card);
  color: #fff;
  gap: 0.3em;
  font-size: 18px;
  border-radius: 30px;
  font-family: var(--font-body);
  @media screen and (max-width: 1200px) {
    font-size: 16px;
  }
  @media screen and (max-width: 480px) {
    font-size: 12px;
    padding-inline: 1.2rem;
  }
`;
