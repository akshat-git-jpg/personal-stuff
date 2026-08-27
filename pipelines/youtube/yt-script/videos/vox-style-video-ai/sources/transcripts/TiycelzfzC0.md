[00:00] I fully automated the creation of a full
[00:02] Vox style motion graphic video using
[00:04] just Claude code and Gemini Omni.
[00:07] >> 10 companies now make up 41% of the
[00:10] entire S&P 500, more concentrated than
[00:14] the peak of the dot-com bubble.
[00:16] This year alone, Big Tech will pour 725
[00:20] billion dollars into AI data centers.
[00:23] But look closer. [music]
[00:24] Nvidia invests 100 billion in OpenAI.
[00:28] OpenAI buys 250 billion of computing
[00:31] from Microsoft. The money just loops in
[00:34] a circle.
[00:36] And OpenAI spends 60 billion a year on
[00:39] compute while earning just 13.
[00:43] So, what happens when the music stops?
[00:46] >> This is the system that made that video
[00:48] that we're going to create in this video
[00:49] together. All I did was say {slash} Vox
[00:52] video to activate it, and then I said
[00:54] what I wanted it to be about, which was
[00:56] the AI bubble in this case.
[00:58] And it sent us back the final video once
[01:01] it was done right here, which we can
[01:03] click on to watch and download. This one
[01:06] was only 38 seconds, but you can make it
[01:08] longer if you specify that in the
[01:09] prompt. Gemini Omni is the number one AI
[01:12] video model right now, and this is
[01:14] what's allowing us to make videos like
[01:16] this. In this video, we're going to
[01:17] build the system step by step just with
[01:19] text right here in Claude code.
[01:22] Framework Explained has a great video on
[01:24] some of the prompts for these kinds of
[01:25] videos. I reverse-engineered some of the
[01:27] prompts from his video to create this
[01:30] system. So, definitely go show him some
[01:32] love. I'll leave a link down in the
[01:33] description.
[01:35] His video's also good for going into why
[01:38] the prompts work and what works best
[01:42] between different AI video models. If
[01:44] you've never heard of Vox before, this
[01:46] is the YouTube channel. These are their
[01:48] most popular videos. As you can see,
[01:50] they do really, really well. And at this
[01:54] point, when you have a a this big, you
[01:56] basically have your own company. This
[01:58] channel is now a company and an entire
[02:01] business in itself. So, how much does it
[02:03] cost? Claude code is $20 a month to
[02:06] actually build the system itself. Then
[02:08] you have Key AI, which is $3.50,
[02:11] roughly around there, per 35-second
[02:14] chapter. So, if you wanted four
[02:16] chapters, all 35 seconds, in one longer
[02:19] video,
[02:20] that would be 4 * 3.5
[02:24] for that full video.
[02:26] And Eleven Labs is free, and the next
[02:28] plan up, if you end up using a lot of
[02:30] credits, is only about $6. So, that's
[02:33] pretty cheap. So, let's get started on
[02:35] the build. You're going to need to
[02:36] download the Claude desktop app, if you
[02:38] haven't already. You can just search for
[02:39] Claude download, and make sure it's on
[02:41] the official Claude website,
[02:43] claude.com/download,
[02:46] and then download it for your operating
[02:48] system. Once you're logged in, you're
[02:49] going to want to make sure you're on
[02:50] code up here in the top left.
[02:54] Then you can go ahead and collapse the
[02:56] sidebar for now.
[02:59] And down here,
[03:00] click on this little file icon right
[03:03] here, and click on open folder.
[03:07] Now, wherever you want on your computer,
[03:09] I'm just going to do my desktop just for
[03:11] simplicity.
[03:12] You can right click,
[03:14] go new folder, and create a new folder,
[03:16] and that's where your project is going
[03:18] to be built. So, I already have an empty
[03:20] one right here called Vox videos. I'm
[03:23] just going to select that and click on
[03:25] select folder. Now, over here on the
[03:27] sidebar, just make sure you're on a new
[03:29] session,
[03:30] and I'm going to be using Fable 5, but
[03:32] you can use Opus 4.8 if you want.
[03:35] And I'm on a bypass permissions mode
[03:37] just to kind of speed things up, but
[03:39] that is optional as well.
[03:41] So, in the description, you will find
[03:44] this entire prompt, which you can go
[03:46] ahead and copy. And once you paste that
[03:48] in, you can essentially just hit enter
[03:50] and let it get to work.
[03:53] Now, it's going to start asking you some
[03:54] questions, but before you answer any,
[03:56] there's one thing we need to do.
[03:59] We need to go to the spot where we the
[04:00] same folder that we just selected for
[04:02] the project to be built in.
[04:05] So, again, I selected on my desktop, so
[04:07] that's it. This is it right here.
[04:10] And we're going to need to download
[04:13] these four files, which I've set up and
[04:15] there's a link in the description to
[04:16] download these four files. And what
[04:18] these are, we'll get into all of this a
[04:20] little bit later, but essentially, it's
[04:22] just how to prompt the videos,
[04:25] how to prompt the images,
[04:28] and an example style reference. So, we
[04:32] open this up, this is the style
[04:34] reference for the videos, so that it
[04:36] understands
[04:38] how to make the videos and the images,
[04:41] right?
[04:43] Um and so, you're just going to want to
[04:44] select all of these and go ahead and
[04:46] click on download.
[04:48] Once you've downloaded those,
[04:50] again, this is the same folder that we
[04:52] selected in Claude,
[04:54] we're just going to put it right in
[04:56] here, and now Claude has access to all
[04:59] of that information.
[05:01] So, we can go back into Claude,
[05:03] and so, it's going to it's asking us
[05:05] about them right now.
[05:06] A reference image prompt guideline,
[05:10] but the folder is empty. How should I
[05:12] handle these?
[05:13] So, we'll just say, I'll add them
[05:14] myself.
[05:16] Or we could write,
[05:17] I added them or whatever. I'll just say,
[05:19] I'll add them myself, right? Boom.
[05:22] What aspect ratio should the videos be?
[05:23] So, I'm going to go 16 by 9 landscape.
[05:27] For the 11 Labs narration voice, do you
[05:29] have a specific voice in mind? I'm just
[05:31] going to say, pick a good default, but
[05:33] if you have a specific one, you can
[05:34] always choose that.
[05:38] For background music, where do the songs
[05:39] come from?
[05:41] I'll drop files in a music folder. So, I
[05:44] am going to click this one right here. I
[05:46] actually haven't done that yet, so I'm
[05:48] going to add that right now. So, in the
[05:49] same folder, I'm just going to paste in
[05:51] a song. I just searched on YouTube
[05:54] intense violin,
[05:56] and I eventually found this one song.
[05:58] You can paste in whatever song you want.
[06:01] Okay, so where did the songs come from?
[06:03] Now, we can say, I'll drop the files in
[06:07] a music folder, but it'll find the song
[06:09] regardless because we put it in the
[06:11] project files. So, we can say, I'll drop
[06:13] it in there.
[06:15] And now we've answered the questions and
[06:16] added all the files, and we can let it
[06:19] do its work. While that's running in the
[06:21] background and building it, let's
[06:22] quickly go over how it works because we
[06:24] pasted in that big block of text, but
[06:26] what is that actually telling Claude to
[06:28] do?
[06:29] So, essentially,
[06:31] what it's telling Claude to do is build
[06:33] a system that does these five steps
[06:35] right here.
[06:37] So, we'll send in the prompt, for
[06:38] example, the AI bubble, right? Whatever
[06:41] we want the video to be about,
[06:43] and it's going to generate a speech, but
[06:45] it's going to separate the speech into
[06:48] four or more separate parts,
[06:52] and then what it's going to do is
[06:55] for the reference images,
[06:58] each image is going to be based on the
[07:01] speech. So, if it's about a door, for
[07:04] example, a door
[07:06] in image in speech one, if he says, "The
[07:09] door opened."
[07:11] then
[07:12] in image one, it might be a door, right?
[07:15] Or a door opening, or whatever.
[07:18] And each of these images is being
[07:21] generated using that reference image
[07:23] from earlier, so that they're all in the
[07:26] same style.
[07:28] So, now you have a bunch of images based
[07:30] on the speech and what's being said,
[07:34] but they're not moving yet, so that's
[07:35] the fifth step. Each image is going to
[07:39] be turned into a video using Gemini
[07:41] Omni.
[07:42] And
[07:44] the speech itself is also going to be
[07:46] used as context for the video.
[07:50] So, if in the middle of the video it
[07:51] says, "The door opens." That's going to
[07:54] go into the prompt. So, right when that
[07:56] is said,
[07:57] the door opens.
[07:59] And then it's going to combine all of
[08:00] those clips into the final video. The
[08:03] good thing about Claude is let's say you
[08:04] don't like the video number two, you can
[08:07] tell Claude regenerate this one and it
[08:09] will regenerate just that video and
[08:12] still combine all of the other videos
[08:14] into the final video. Here is the full
[08:17] reference image that I'm talking about.
[08:20] In the Google Drive, there is also this
[08:22] master prompt. Again, credit to
[08:24] Framework Explained, link in the
[08:26] description. He's an absolute legend.
[08:28] This is the kind of image that this is
[08:30] going to make.
[08:32] And you can go ahead and change this or
[08:35] generate your own. Here's a few other
[08:37] examples, right? Like this one's kind of
[08:39] like a rush hour.
[08:40] This one's like a murder mystery, etc.
[08:42] All right, it looks like our project is
[08:44] done and it's asking us to do one more
[08:46] thing, which is to fill in the 11 Labs
[08:50] API key and the key API key.
[08:53] So, 11 Labs is for the speech and key is
[08:56] for the images and the videos.
[08:58] So, the first thing we're going to do is
[09:00] go to 11 Labs to get the API key to
[09:02] authenticate for speech.
[09:05] So, you can find a link to 11 Labs in
[09:07] the description.
[09:08] Once you are signed in, in the bottom
[09:11] left, just click on developers.
[09:15] Then click on API keys here at the top.
[09:18] Click on create key over here on the
[09:20] right.
[09:22] Just turn off restrict key.
[09:25] And then in the bottom right down here,
[09:27] just click on create key.
[09:30] Now, that's going to give you a API key
[09:34] on screen. It's only going to pop up
[09:35] once. Just click on copy
[09:38] and bring that over here back into
[09:40] Claude.
[09:41] So, back in our project files,
[09:47] right? These are the project files. I
[09:48] made mine on my desktop, wherever you
[09:50] made yours.
[09:51] You're going to want to look for .env.
[09:55] So, go ahead and open up .env. You can
[09:57] right-click, open with Notepad.
[10:01] And it's going to look something like
[10:02] this. So, 11 Labs API key equals right
[10:06] after the API key equals right after the
[10:09] equal sign, you're going to want to
[10:11] paste that key you just copied.
[10:13] Go ahead and paste it right there. Now,
[10:15] once you've pasted it in, go ahead and
[10:16] click file,
[10:18] save.
[10:20] Then, we're going to need the key API
[10:22] key. So, for that, you can find a link
[10:25] to key in the description.
[10:27] Once you are signed in on here,
[10:30] you're going to want to go to billing
[10:32] over here on the left and add a little
[10:34] credits. You can add as little as $5.
[10:37] Once you've added some credits, you can
[10:39] come on the left over here to API keys,
[10:42] click on create new key,
[10:46] all models,
[10:47] enter a name right here, and click on
[10:49] create. That's also going to give you
[10:52] the API key, which you can then copy.
[10:55] You can also copy it just by clicking
[10:57] this little button next to it right
[10:58] here.
[10:59] Now, once you've copied it, you're going
[11:01] to go back into your .env.
[11:05] And you're going to paste it right after
[11:07] the equal sign, as well. I'm not going
[11:09] to put it on here,
[11:10] but you would just paste it right there
[11:13] after the equal sign in the Notepad.
[11:16] Then, what you're going to do is click
[11:17] file and save. Now that those are both
[11:20] saved to .env, you can see here this is
[11:22] the command we're going to use, right?
[11:24] Which is /vox video.
[11:26] Now, often this won't show up unless you
[11:28] restart Claude. So, we're just going to
[11:30] close it up here in the top right.
[11:32] Close.
[11:34] And then reopen Claude. Okay. So, we're
[11:37] going to make sure we're still on our
[11:39] session here. CL3 Vox Videos is the name
[11:42] of mine. Make sure you're still on your
[11:44] folder.
[11:45] And so, this is our old chat over here,
[11:48] but we're in a new session now, but
[11:49] we're still in the same project. So, we
[11:51] can test it out. We can do {slash}
[11:54] Vox video.
[11:56] And let's do the same thing. We'll do
[11:57] the AI
[12:00] bubble.
[12:01] And we'll just send that off.
[12:03] All right. Looks like Claude is done
[12:05] making our video, so let's check it out.
[12:08] Now, it's not letting me full screen it
[12:09] right here. So, we can find all our past
[12:11] videos
[12:13] right here in the output folder. Here it
[12:16] is, AI bubble and final.
[12:18] >> This year, five tech giants will pour
[12:21] 725 billion dollars into AI data
[12:24] centers, up 77% in 1 year.
[12:28] But the money moves in a circle.
[12:30] Nvidia invests in Open AI. Open AI pays
[12:33] Oracle for compute.
[12:35] Oracle buys Nvidia's chips. Over 800
[12:38] billion dollars in circular deals, while
[12:40] Open AI loses 14 billion this year.
[12:44] Central bankers are calling it dot-com
[12:46] deja vu.
[12:48] If demand doesn't catch up, this bubble
[12:50] could sink the whole economy.
[12:53] >> And there you go. I think that was
[12:55] pretty good, personally.
[12:57] A few notes for the prompt is you can
[12:59] actually leave it empty and it will just
[13:02] come up with a random news
[13:04] politics-based video.
[13:06] You can put in the USA and it'll make do
[13:09] stuff about the USA, whatever's
[13:11] happening currently
[13:12] uh and recently, that's what it will go
[13:14] off of.
[13:16] And if you want it to be longer, just
[13:18] say make it three chapters, make it four
[13:21] chapters, whatever, cuz each chapter is
[13:22] about 30 to 40 seconds. And if you do
[13:25] want to make any personal changes, just
[13:27] make sure you come back into this same
[13:30] session that you built it in just so it
[13:31] has context.
[13:33] And it might let you know that you don't
[13:35] have enough credits. So, if you need
[13:36] more credits, you can do that right here
[13:38] on Key AI. And for 11 Labs, it's just up
[13:42] here in the top right. That's going to
[13:44] do it for this video. Be sure to
[13:45] subscribe if you want to see more like
[13:47] this, and I'll see you in the next one.
[13:49] Peace.
