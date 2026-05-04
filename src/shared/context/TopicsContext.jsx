import React, { createContext, useContext, useMemo, useState } from 'react';

const TopicsContext = createContext({
  topics: [],
  setTopics: () => {},
  region: 'BR',
  setRegion: () => {},
});

export function TopicsProvider({ children }) {
  const [topics, setTopics] = useState([]);
  const [region, setRegion] = useState('BR');
  const value = useMemo(
    () => ({ topics, setTopics, region, setRegion }),
    [topics, region],
  );
  return <TopicsContext.Provider value={value}>{children}</TopicsContext.Provider>;
}

export function useTopics() {
  return useContext(TopicsContext);
}
