# Vehicle & Camera

## Vehicle-feel principle
Convincing arcade handling is not the same thing as realistic physics. Input mapping, acceleration, braking, steering-vs-speed, traction/slip, assists, recovery, collision forgiveness, perceived weight, and camera coupling all contribute to feel.

## Core-toy test
Before adding meta systems, disable their importance mentally and ask:

> Is riding through traffic for five minutes enjoyable by itself?

If not, keep working on the toy.

## Current handling questions
- Is steering predictable at both low and high speed?
- Can the player correct a bad line without feeling magnetised or weightless?
- Does braking give enough agency before a readable hazard?
- Are crashes caused by visible contact rather than hidden collision volume?
- Does recovery return control quickly without chain punishment?

## Camera goals
Balance two competing needs:
1. strong sensation of speed;
2. enough forward readability to judge traffic.

Evaluate height, distance, pitch, FOV, look-ahead, damping, speed response, turn response, collision response, shake, horizon stability, and motion comfort as one system.

## Current branch history
The first camera pass moved the camera closer/lower and reduced speed-based pullback while retaining forward look-ahead. Screenshot evidence suggested stronger bike presence in frame, but subjective feel remains unvalidated without direct human play.

## Decision rule
Do not change vehicle handling and camera aggressively in the same experiment unless the problem explicitly involves their coupling. Isolate variables where practical so a good or bad result can be attributed.
