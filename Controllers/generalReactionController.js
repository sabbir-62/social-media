const Comment = require("../Models/commentModel");
const CommentReply = require("../Models/commentReplyModel");
const GeneralReaction = require("../Models/generalReactionModel");
const Post = require("../Models/postModel");
const ReplyInReply = require("../Models/replyInReplyModel");
const userProfileModel = require("../Models/user_profile_Model");

// Add or remove reaction based on user's click=========
const toggleReaction = async (req, res) => {
    try {
        const {
            userId,
            targetType,
            targetId,
            type
        } = req.body;

        // Validation: Check if required fields are present
        if (!userId || !type || !targetType || !targetId) {
            return res.status(400).json({
                success: false,
                message: 'userId, targetId, and type are required.'
            });
        }

        // Validation: Check if targetType is present and valid
        if (targetType && !['Post', 'Comment', 'CommentReply', 'ReplyInReply'].includes(targetType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid targetType.'
            });
        }

        // Validation: Check if targetId is present and valid (if targetType is provided)
        if (targetType && targetType !== 'Post' && !targetId) {
            return res.status(400).json({
                success: false,
                message: 'targetId is required for targetType other than Post.'
            });
        }

        // Validation: Check additional constraints based on targetType
        if (targetType === 'Comment' && !targetId) {
            return res.status(400).json({
                success: false,
                message: 'targetId is required for Comment targetType.'
            });
        }

        if ((targetType === 'CommentReply' || targetType === 'ReplyInReply') && !targetId) {
            return res.status(400).json({
                success: false,
                message: 'targetId is required for CommentReply or ReplyInReply targetType.'
            });
        }

        // Validation: Check if the targetId exists in the database
        if (targetType === 'Post') {
            const post = await Post.findOne({
                _id: targetId
            });
            if (!post) {
                return res.status(404).json({
                    success: false,
                    message: 'Post not found.'
                });
            }
        } else if (targetType === 'Comment') {
            const comment = await Comment.findOne({
                _id: targetId
            });
            if (!comment) {
                return res.status(404).json({
                    success: false,
                    message: 'Comment not found.'
                });
            }
        } else if (targetType === 'CommentReply') {
            const commentReply = await CommentReply.findOne({
                _id: targetId
            });
            if (!commentReply) {
                return res.status(404).json({
                    success: false,
                    message: 'CommentReply not found.'
                });
            }
        } else if (targetType === 'ReplyInReply') {
            const replyInReply = await ReplyInReply.findOne({
                _id: targetId
            });
            if (!replyInReply) {
                return res.status(404).json({
                    success: false,
                    message: 'ReplyInReply not found.'
                });
            }
        }

        // Check if the user has already reacted
        const existingReaction = await GeneralReaction.findOne({
            userId,
            targetType,
            targetId
        });

        // Check if the user exists in the database
        const user = await userProfileModel.findOne({
            _id: userId
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (existingReaction) {
            // If the user has already reacted, check if it's the same reaction type
            if (existingReaction.type === type) {
                // If it's the same reaction type, remove the reaction
                await existingReaction.deleteOne();
                res.status(200).json({
                    success: true,
                    message: 'Reaction removed successfully'
                });
            } else {
                // If it's a different reaction type, update the existing reaction
                existingReaction.type = type;
                await existingReaction.save();
                res.status(200).json({
                    success: true,
                    message: 'Reaction updated successfully'
                });
            }
        } else {
            // If the user hasn't reacted yet, add a new reaction
            await GeneralReaction.create({
                userId,
                targetType,
                targetId,
                type
            });
            res.status(200).json({
                success: true,
                message: 'Reaction added successfully'
            });
        }

        // Update reaction count based on targetType
        if (targetType === 'Post') {
            await updatePostReactionCount(targetId);
        } else if (targetType === 'Comment') {
            await updateCommentReactionCount(targetId);
        } else if (targetType === 'CommentReply') {
            await updateCommentReplyReactionCount(targetId);
        } else if (targetType === 'ReplyInReply') {
            await updateReplyInReplyReactionCount(targetId);
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update reaction'
        });
    }
};


// Helper function to update post reaction count=================
const updatePostReactionCount = async (postId) => {
    const reactionCount = await GeneralReaction.countDocuments({
        targetType: 'Post',
        targetId: postId
    });
    await Post.findByIdAndUpdate(postId, {
        $set: {
            reactionCount
        }
    });
};

// Helper function to update comment reaction count===========
const updateCommentReactionCount = async (commentId) => {
    const reactionCount = await GeneralReaction.countDocuments({
        targetType: 'Comment',
        targetId: commentId
    });
    await Comment.findByIdAndUpdate(commentId, {
        $set: {
            reactionCount
        }
    });
};

// Helper function to update reply reaction count===========
const updateCommentReplyReactionCount = async (commentReplyId) => {
    const reactionCount = await GeneralReaction.countDocuments({
        targetType: 'CommentReply',
        targetId: commentReplyId
    });
    await CommentReply.findByIdAndUpdate(commentReplyId, {
        $set: {
            reactionCount
        }
    });
};

// Helper function to update nested reply reaction count
const updateReplyInReplyReactionCount = async (nestedReplyId) => {
    const reactionCount = await GeneralReaction.countDocuments({
        targetType: 'ReplyInReply',
        targetId: nestedReplyId
    });
    await ReplyInReply.findByIdAndUpdate(nestedReplyId, {
        $set: {
            reactionCount
        }
    });
};

// get specificReactions=========================================
const getSpecificReactions = async (req, res) => {
    try {
        const {
            targetType,
            targetId
        } = req.body;

        // Validate targetType and targetId
        if (!targetType || !targetId) {
            return res.status(400).json({
                success: false,
                message: 'targetType and targetId are required.',
            });
        }

        // Fetch reactions based on targetType and targetId
        const reactions = await GeneralReaction.find({
            targetType,
            targetId
        });

        // Finding targeted id for validation check
        const post = await Post.findOne({
            _id: targetId
        });
        const comment = await Comment.findOne({
            _id: targetId
        });
        const reply = await CommentReply.findOne({
            _id: targetId
        });
        const nestedReply = await ReplyInReply.findOne({
            _id: targetId
        });

        // Validation check
        if (!post && !comment && !reply && !nestedReply) {
            return res.status(404).json({
                success: false,
                message: "Target ID Not Found"
            });
        }

        // Check if there are no reactions
        if (!reactions || reactions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No reactions found for the specified target."
            });
        }

        // Create an object to store user-specific reaction counts for each type
        const reactionTypeCounts = {};

        // Iterate through reactions to track user-specific counts for each type
        reactions.forEach((reaction) => {
            const {
                userId,
                type
            } = reaction;

            if (!reactionTypeCounts[type]) {
                reactionTypeCounts[type] = {};
            }

            if (!reactionTypeCounts[type][userId]) {
                reactionTypeCounts[type][userId] = 1;
            } else {
                reactionTypeCounts[type][userId] += 1;
            }
        });

        // Calculate the total count for each reaction type
        const totalCounts = {};
        for (const type in reactionTypeCounts) {
            totalCounts[type] = Object.values(reactionTypeCounts[type]).reduce((sum, count) => sum + count, 0);
        }

        // Create a sorted list of users for each reaction type with counts and usernames
        const sortedUserLists = {};
        const reactionTypesOrder = Object.keys(reactionTypeCounts);
        for (const type of reactionTypesOrder) {
            const users = await Promise.all(
                Object.keys(reactionTypeCounts[type])
                .sort((a, b) => reactionTypeCounts[type][b] - reactionTypeCounts[type][a])
                .map(async (userId) => {
                    const user = await userProfileModel.findOne({
                        _id: userId
                    });
                    return user ? user.userName : 'Unknown';
                })
            );
            sortedUserLists[type] = {
                totalCount: totalCounts[type],
                users
            };
        }

        res.status(200).json({
            success: true,
            data: sortedUserLists
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch specific reactions',
            error: error.message
        });
    }
};

// get all reactions...=======================================
const getTotalReactionsCount = async (req, res) => {
    try {
        const {
            targetType,
            targetId
        } = req.body;

        // Validate targetType and targetId
        if (!targetType || !targetId) {
            return res.status(400).json({
                success: false,
                message: 'targetType and targetId are required.',
            });
        }

        const totalReactionsCount = await GeneralReaction.countDocuments({
            targetType,
            targetId
        });

        // finding targeted id for validation check==========
        const post = await Post.findOne({
            _id: targetId
        });
        const comment = await Comment.findOne({
            _id: targetId
        });
        const reply = await CommentReply.findOne({
            _id: targetId
        });
        const nestedReply = await ReplyInReply.findOne({
            _id: targetId
        });

        // validation check ================================
        if (!post && !comment && !reply && !nestedReply) {
            return res.status(404).json({
                status: "Failed",
                message: "Target ID Not Found..."
            });
        }

        // Validate that the targetType matches the type of the found document
        if ((targetType === 'Post' && !post) || (targetType === 'Comment' && !comment) ||
            (targetType === 'CommentReply' && !reply) || (targetType === 'ReplyInReply' && !nestedReply)) {
            return res.status(400).json({
                status: "Failed",
                message: "targetType and targetId do not match."
            });
        }

        res.status(200).json({
            success: true,
            data: {
                totalReactionsCount
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch total reactions count'
        });
    }
};

module.exports = {
    toggleReaction,
    getSpecificReactions,
    getTotalReactionsCount
}