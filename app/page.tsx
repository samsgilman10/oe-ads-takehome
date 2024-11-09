'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, TextField, Button, Typography, Paper, List, CircularProgress, Box, AppBar, Toolbar } from '@mui/material';
import { styled } from '@mui/system';
import {v4 as uuidv4} from 'uuid';

interface HistoryItem {
  role: string;
  content: string;
}

const StyledPaper = styled(Paper)({
  padding: '1rem',
  marginTop: '1rem',
  marginBottom: '1rem',
  fontFamily: 'Open Sans, sans-serif',
});

const StyledButton = styled(Button)({
  height: '56px', // to match TextField height
});

const FixedAppBar = styled(AppBar)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1100,
});

export default function Home() {
  const [previousQuestionId, setPreviousQuestionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [answer, setAnswer] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [adTagUrl, setAdTagUrl] = useState<string>('');

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // clear out ad tag just in case since it's possible it was set after
    // the question was answered if the request was slow
    setAdTagUrl('');
    setLoading(true);

    scrollToBottom();

    // generate new uuid client-side to make sure both ad and ask requests point
    // to the same question in the database
    const questionId = uuidv4();

    // using traditional promise syntax to handle both requests concurrently
    axios.post('/api/ask', { 
      question,
      history, 
      questionId,
      previousQuestionId,
    }).then(askResponse => {
      setHistory([
        ...history,
        { role: 'user', content: question },
        { role: 'assistant', content: askResponse.data.answer }
      ]);
      setAnswer(askResponse.data.answer);
      setQuestion('');
    }).catch(error => {
      console.error('Error fetching the answer:', error);
    }).finally(() => {
      setAdTagUrl('');
      setPreviousQuestionId(questionId);
      setLoading(false);
    })

    axios.post('/api/ads',  {
      question,
      history,
      questionId,
      previousQuestionId,
    }).then(adResponse => {
      setAdTagUrl(adResponse.data.adTagUrl)
    }).catch(error => {
      console.error('Error fetching the ad:', error)
    });
  };

  const handleNewConversation = () => {
    setHistory([]);
    setAnswer('');
    setQuestion('');
    setPreviousQuestionId(null);
    scrollToBottom();
  };

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [loading, history]);

  return (
    <>
      <FixedAppBar position="static">
        <Container maxWidth="md">
          <Toolbar disableGutters>
            <Typography variant="h6" style={{ flexGrow: 1, fontFamily: 'Roboto, sans-serif' }}>
              Simple Ask
            </Typography>
            <Button color="inherit" onClick={handleNewConversation}>New Conversation</Button>
          </Toolbar>
        </Container>
      </FixedAppBar>

      <Container maxWidth="md" style={{ marginTop: '120px', fontFamily: 'Roboto, sans-serif', marginBottom: '250px' }}>
        {history.length > 0 && (
          <List>
            {history.map((item, index) => (
              <StyledPaper elevation={3} key={index}>
                <Typography variant="body1" component="div">
                  <strong>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}:</strong>
                </Typography>
                <Box component="div" dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, '<br />') }} />
              </StyledPaper>
            ))}
          </List>
        )}
        <StyledPaper elevation={3}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <TextField
              label="Ask a question"
              variant="outlined"
              fullWidth
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}  // Disable input while loading
            />
            <StyledButton type="submit" variant="contained" color="primary" disabled={loading}>
              Ask
            </StyledButton>
          </form>
        </StyledPaper>
        {loading && !adTagUrl && (
          <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
            <CircularProgress />
          </Box>
        )}
        {loading && adTagUrl && (
        <Box display="flex" justifyContent="center" alignItems="center" gap="1rem" mt={2}>
          <CircularProgress />
          {/* 300x250 is a standard ad size per IAB */}
          <iframe
            id="ad-iframe"
            src={adTagUrl}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            width="300"
            height="250"
            style={{ border: 'none' }}
          />
          <CircularProgress />
        </Box>
        )}
      </Container>
    </>
  );
}
