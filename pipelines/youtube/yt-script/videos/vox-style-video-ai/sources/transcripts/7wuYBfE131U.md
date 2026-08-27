[00:00] I made this entire Vox style explainer
[00:02] video using only Claude code and
[00:04] Remotion.
[00:05] >> The US and Iran are signing a peace
[00:07] deal.
[00:08] But the downfall of the American Empire
[00:11] has already begun. And it started when a
[00:14] far weaker nation held the Strait
[00:16] [music] of Hormuz hostage.
[00:19] Oil prices skyrocketed to $116
[00:23] a barrel.
[00:24] Pushing American inflation to a 3-year
[00:27] high. And it hit a nation already owing
[00:32] trillion.
[00:33] A debt now bigger than its entire
[00:35] economy.
[00:36] Where the interest [music] alone costs
[00:38] more than its entire military.
[00:41] And the world is quietly leaving the
[00:44] dollar [music] behind.
[00:46] Empires don't end with a war.
[00:49] They end with a bill they can no longer
[00:51] pay.
[00:52] >> In this video, I'll show you the exact
[00:54] step-by-step on how to recreate this
[00:56] scene. And you don't need an expensive
[00:57] motion designer or know how to use After
[01:00] Effects. In fact, you don't even need to
[01:02] know how to code. So, let's get right
[01:04] into it. So, in order to create this
[01:06] 47-second
[01:08] Vox style explainer, what we need to do
[01:10] is we need to follow a few steps. Now,
[01:12] the number one is obviously your
[01:13] storyboard and script. And essentially,
[01:16] you need your script that acts as the
[01:19] timeline. So, my script over here was
[01:21] obviously the the US and Iran peace
[01:23] deal, which I made a video out of. What
[01:26] happens here is that each beat maps to a
[01:29] visual. So, this is my entire script
[01:31] over here in a table. So, you can see
[01:33] the voice-over lines, the US and Iran
[01:35] are signing a peace deal, held the
[01:36] Strait of Hormuz hostage, oil prices
[01:38] [music] skyrocketed. So, the entire
[01:40] thing is just based off of the
[01:42] voice-over first. And then after that,
[01:44] you can see I've got all of the the
[01:46] foreground assets. There's a midground
[01:48] asset. I've got the prompt as well for
[01:51] both the midground and the foreground.
[01:53] Because essentially, what I'll be using
[01:55] here is I'll be using an image
[01:57] generator, most probably GPT 2.0 because
[02:00] that's one of the best image generators
[02:02] that's out there. And moving on from
[02:04] there, once you have your [music] voice
[02:05] over, the next thing you need to do is
[02:08] you need to lock a visual system. So, in
[02:10] my example over here, I'm using one
[02:12] common background across all of the
[02:14] scenes. I'm using the same fonts, the
[02:16] same accent palette, but what changes is
[02:19] the the mid ground and the foreground
[02:22] where you have these different cutouts
[02:24] that appear. So, the first thing we have
[02:26] to do is I'm going to open up Cloud
[02:27] Code. Now, over here I'm setting up a
[02:29] new session. Before I start setting up
[02:32] Remotion, what I need to do is I need to
[02:33] make sure I have a few connectors. So,
[02:35] over here I've got my Higgs Field and
[02:37] Magnific MCP service connected. And in
[02:40] order to do that, what you need to do is
[02:42] you need to go to settings. You can go
[02:43] to capabilities, sorry, connectors, and
[02:45] then you can go to customize. And over
[02:47] here you'll find all of your MCP
[02:49] connectors. Now, if you want to add a
[02:50] new connector, what you can essentially
[02:52] do is you can add a custom connector,
[02:53] and then you can get the MCP server
[02:56] address for Magnific, post it in here.
[02:59] And essentially what this allows Cloud
[03:01] Code to do is instead of you going to
[03:03] Magnific and getting all of these
[03:05] images, you can just prompt it directly
[03:07] through Cloud Code, and it'll be able to
[03:09] like get all of those images for you.
[03:11] [music] So, for example, this is my
[03:13] Magnific MCP server that's set up over
[03:16] here, and you can see that's the server
[03:18] address right there. Okay, so once
[03:19] you've set up your MCP servers, what you
[03:22] need to do is you need to have a proper
[03:24] architecture, a proper folder structure
[03:26] for your project. So, essentially each
[03:29] scene lives in its own folder. Each
[03:31] scene has multiple props that that come
[03:34] up, and obviously they have a shared
[03:36] background. So, I'll show you what that
[03:37] looks like in terms of a folder
[03:38] structure. So, this is what the scenes
[03:41] look like. So, if you look at scene one,
[03:42] these are the cutouts that I got from
[03:45] Magnific, and this is obviously the
[03:47] White House, and this is the shared
[03:48] background over here. And then you will
[03:50] see the shared background is in every
[03:52] scene. So, essentially this is the oil
[03:54] tanker [music] scene and you've got a
[03:55] shared background here as well. So, it's
[03:57] there in all of them. And then, the only
[03:59] thing that changes is that in each
[04:01] scene, you've got a different cutout,
[04:03] right? And I'll show you how that plays
[04:05] in once we start building these scenes.
[04:08] So, the next thing I'm going to do now
[04:09] is I'm going to set up the Remotion
[04:11] project. So, I'll just copy this prompt
[04:14] and I'll go here and I'll just set that
[04:16] up.
[04:19] Oh, before I do that, I need to actually
[04:21] select a folder. So, what I'm going to
[04:23] do is I'm going to select the scenes
[04:25] folder over here. Select folder and then
[04:27] just run that prompt again.
[04:33] So, while the Remotion project is being
[04:35] set up, I'll show you how this worked.
[04:37] Now, the reason why we have a locked
[04:38] background is because it gives that
[04:40] whole vox style animation where the the
[04:43] background is static, but then things
[04:46] are like moving in. So, it looks like
[04:47] it's one continuous shot instead of like
[04:50] having a [music] lot of different cuts
[04:51] in the middle. And essentially, the way
[04:53] how it works is each scene is made up of
[04:56] three layers. So, you have the
[04:57] background over here and then you have
[04:58] the midground, which I choose, you know,
[05:01] as a black and white half tone pattern
[05:04] of characters popping up. And then the
[05:05] foreground structures essentially,
[05:07] right? So, they can be structures and
[05:09] they can be some sort of scenery, ships,
[05:11] whatever it may be. That's just how I do
[05:13] it and I've seen a few vox animations
[05:16] where they use this style. There are
[05:18] many different styles and [music] this
[05:19] is just the one that I've I've gone for.
[05:21] So, the next thing you want to do is you
[05:22] want to get cutouts of your scenes. For
[05:25] example, over here of Donald Trump and
[05:27] Kamin-A. You don't have to actually go
[05:30] and do this yourself. So, essentially
[05:31] what you can do is you can get a
[05:33] transparent image of Donald Trump or
[05:36] whoever that the character might be. And
[05:38] essentially, what you can do is you can
[05:40] tell Claude code to make the image of
[05:43] Donald Trump in the folder as black and
[05:45] white and give it a half tone pattern to
[05:47] finish. You can see over here as well,
[05:49] like do the same for the image of
[05:51] Kamina. And this is what you get out of
[05:53] [music] it, right? So, it gives that
[05:55] magazine sort of feel, that papery feel,
[05:58] a texture that you would get. Uh so, it
[06:00] doesn't look all digital. I mean, I'm a
[06:02] huge fan of the way how Vox does their
[06:05] animations, and this is just like one
[06:07] way to sort of simulate that. If you go
[06:09] to the scene file over here, and this is
[06:12] what it actually looks like. Okay. So,
[06:15] the way how we're going to do this is
[06:18] we're going to be animating with intent.
[06:20] And what I mean by that is we're going
[06:22] to be using just two functions. Again,
[06:23] you don't have to know these function
[06:25] calls, you don't have to to necessarily
[06:27] know how to code. But just for you to
[06:28] understand, there's a spring function,
[06:30] and then there's a interpolate. So,
[06:32] essentially, spring is what does the
[06:33] whole pop-up effects and all that. And
[06:36] what happens over here is you don't even
[06:37] have to say to use a spring function
[06:40] over here. So, you can essentially say
[06:41] plain English, "Animate scene one with
[06:43] the White House spring up first,
[06:45] followed by Donald Trump and Kamina
[06:47] right after. Stagger them so they don't
[06:49] all move at once. Give me an offset red
[06:52] marker stroke behind each cutout [music]
[06:54] for the midground characters." And this
[06:56] gives you that signature sort of red
[06:58] sort of stroke just to give it that a
[07:01] little bit of a 3D illusion, and it just
[07:03] honestly just looks nice. So, I will
[07:05] copy this prompt here. So, it looks like
[07:07] Claude Code is still running, setting up
[07:10] the Remotion dependencies. Okay. So, now
[07:13] what it's done is [music] it set up the
[07:15] first scene with our characters in the
[07:19] midground and White House in the
[07:20] foreground. So, I'm just going to let it
[07:22] complete, and then what we will do is we
[07:24] will get it to start a Remotion server
[07:26] for us, or Remotion Studio. And then
[07:28] we'll go inside Remotion Studio, and we
[07:31] need to make a few fine adjustments.
[07:35] All right. So, it's giving me some
[07:36] commands to start the Remotion Studio.
[07:40] But what I can do is I can just ask it
[07:42] in [music] plain English to stop the
[07:43] studio for me. Stop the Remotion studio
[07:45] for me, please.
[07:48] All right. So, this is what the first
[07:50] scene looks like.
[07:52] And you can see it's not actually the
[07:55] best because we [music] need to go make
[07:56] some changes here. So, that's exactly
[07:58] what we're going to do. So, one thing if
[08:00] you notice over here, we've got this
[08:02] error. So, I'm I'm just going to go and
[08:03] sort out this error. So, I'll go back to
[08:06] my Claude code. Uh fix this error,
[08:08] please.
[08:17] All right. So, it's fixed that error for
[08:19] us. Now, the next thing we want to do is
[08:21] we want to start adjusting our
[08:23] characters. And this is where it's
[08:24] really important if you don't see these
[08:27] prop controls over here. So, make sure
[08:28] you go back to your Claude code and ask
[08:31] it to give you a prop control for all
[08:34] the elements on the screen. So, this is
[08:36] the prop control for Kamala Harris. What
[08:38] I'm going to do is I'm going to start
[08:39] tweaking some of these scale controls.
[08:42] So, for example, I can put the scale to
[08:44] 1.4 and you'll see Donald Trump just
[08:46] becomes a bit bigger over there. So, I
[08:49] can change the XY positions. And what
[08:51] you need to do, guys, is also you need
[08:52] to save these numbers as well. So, if I
[08:55] do the scale as 1.4, so you'll see that
[08:57] it's changed the scale, but make sure
[08:59] you save it. So, it stays like that. And
[09:01] then I can change the XY positions here.
[09:04] But before we do this, we might have to
[09:06] actually change the size and scale of
[09:09] the White House. So, I'll set this to a
[09:11] scale of 1.5.
[09:13] Okay, maybe I'll make it slightly
[09:16] bigger, 1.6. Save that. And then I'm
[09:19] going to set this uh Y axis maybe all
[09:23] the way down here. So, let's see what
[09:25] that looks like. So, the White House
[09:27] comes first and then Donald Trump and
[09:29] Kamala Harris. So, the White House is
[09:31] fine. Now, I just need to fix both of
[09:34] these characters here. Maybe make the
[09:35] White House slightly bigger, 1.8.
[09:43] So, I think that scene is done, and
[09:46] that's what that looks like. So, just to
[09:48] run it again, so you have the White
[09:50] House pop up first, and then you have
[09:51] the two [music] characters pop up right
[09:53] behind. So, now that we've made those
[09:55] changes, so what you get is a bunch of
[09:58] different scenes. Now, let me show you
[10:00] what those scenes look like. So, you'll
[10:02] see this is like a debt transition
[10:04] scene. So, this is an oil tanker scene.
[10:06] Now, for this one, what I did was this
[10:08] there's an actual like green screen
[10:11] ocean video that you can download off of
[10:14] Magnific, and essentially, it's just an
[10:17] animated or or like an actual video of
[10:19] an ocean with the background just
[10:22] removed. And this is what that looks
[10:23] like.
[10:28] And you can see there's a number that
[10:29] comes up right after just to show that
[10:31] oil prices have shot up. So, each scene,
[10:34] guys, would be like in a different file,
[10:36] essentially, right? So, this is the
[10:37] scene for the debt inflation, for
[10:40] example.
[10:42] And you'll see a bar chart, or sorry, a
[10:44] line chart just pops up along with a US
[10:47] map. And then we have a transition scene
[10:49] over here, as well.
[10:51] >> [music]
[10:53] >> So, once you have all of these scenes,
[10:55] what you need to do is you need to put
[10:57] them together. After you've done all of
[10:58] your fine adjustments, the next thing
[11:00] you want to do is you want to make you
[11:02] want to assemble a master sequence. So,
[11:04] now you can get Claude code to stitch
[11:06] all of these scenes together in one
[11:08] video in order, each one playing for as
[11:11] long as it's part of the voiceover, so
[11:13] they run back-to-back as a single film.
[11:15] The next thing you want to do, right
[11:17] after this, is you want to do your
[11:19] voiceovers. [music]
[11:20] Now, you can obviously use Claude code
[11:22] to do your voiceovers, but then I go
[11:24] separately to 11 Labs, and I generate my
[11:27] voiceover just because I've got like
[11:28] these saved voices on there. So, let me
[11:31] show you how that works. So, you can go
[11:32] into 11 Labs and you can go to
[11:34] text-to-speech and I use Kate, which is
[11:36] cinematic British RP narrator, and then
[11:39] you can generate the speech.
[11:41] >> The US and Iran are signing a peace
[11:43] deal.
[11:43] >> Okay. So, once you have this, you can
[11:45] download it and put it into the same
[11:47] folder, and you can come back to your
[11:49] Claude code, and you can ask Claude code
[11:51] to sync your entire clip to this
[11:54] voice-over. So, this is the prompt for
[11:55] that. So, I'm going to say, "Embed the
[11:57] voice-over into the composition and
[11:58] sequence the scenes to it. Each scene
[12:00] should start and end on its own
[12:02] narration." And once you've done that,
[12:04] once you've done the voice-overs, the
[12:06] next step is just some music. You need a
[12:08] bit of polish, and you might even need
[12:11] uh some Foley, some background sounds as
[12:13] well. Sometimes what happens is when
[12:15] you're scrubbing through uh Remotion
[12:18] Studio, what might happen is the audio
[12:20] might sound jerky. Um don't worry about
[12:22] this. This is This is just like a
[12:24] Remotion thing, but then once you render
[12:25] it, it's it's going to sound clean. So,
[12:28] once you've done all of that, you can
[12:29] literally ask Claude code to render the
[12:32] whole thing as a 1080p MP4 video with
[12:36] the music and voice-over mixed in. If
[12:38] you'd much rather do the music and
[12:40] voice-over later in Adobe Premiere Pro,
[12:43] you can do that, too. You can just get
[12:45] the composition by itself, and then do
[12:46] the music and voice-over separately. So,
[12:49] there you have it. A fully animated
[12:51] motion design in just a few minutes. If
[12:53] you're interested in these kind of
[12:54] videos, then do subscribe. [music]
[12:56] I have a whole lot more Claude code and
[12:58] motion graphics videos planned, so you
[13:00] won't want to miss that. But until then,
[13:02] have a good one.
